import * as vscode from "vscode"
import * as dotenvx from "@dotenvx/dotenvx"
import * as fs from "fs"
import * as path from "path"

// Load environment variables from .env file
// The extension-level .env is optional (not shipped in production builds).
// Avoid calling dotenvx when the file doesn't exist, otherwise dotenvx emits
// a noisy [MISSING_ENV_FILE] error to the extension host console.
const envPath = path.join(__dirname, "..", ".env")
if (fs.existsSync(envPath)) {
	try {
		dotenvx.config({ path: envPath })
	} catch (e) {
		// Best-effort only: never fail extension activation due to optional env loading.
		console.warn("[jabberwock] Failed to load environment variables:", e)
	}
}

import type {
	CloudUserInfo,
	AuthState,
	JabberwockAPI,
	JabberwockAPIEvents,
	JabberwockEventName,
	JabberwockSettings,
	ProviderSettings,
	ProviderSettingsEntry,
	TaskEvent,
} from "@jabberwock/types"
import { IpcMessageType, IpcOrigin, IntentType, IntentStatus, TaskCommandName } from "@jabberwock/types"
import type { TaskCommand } from "@jabberwock/types"
import { IpcServer } from "@jabberwock/ipc"
import { createCloudService, getCloudService, hasCloudService } from "@jabberwock/cloud"
import {
	createTelemetryService,
	getTelemetryService,
	hasTelemetryService,
	PostHogTelemetryClient,
} from "@jabberwock/telemetry"
import { customToolRegistry } from "@jabberwock/core"
import { configure } from "mobx"

import "./utils/path" // Necessary to have access to String.prototype.toPosix.
import { createOutputChannelLogger, createDualLogger } from "./utils/outputChannelLogger"
import { initializeNetworkProxy } from "./utils/networkProxy"

import { Package } from "./shared/package"
import {
	setProviderSettingsManager,
	getProviderSettingsManager,
} from "./features/settings/models/ProviderSettingsManager"
import { initModesFileService } from "./features/settings/agents/modesFileService"
import { formatLanguage } from "./shared/language"
import { initVscodeContext, getVscodeContext } from "./features/foundation/vscode/context"
import { getSettingsAccess } from "@utils/settings-access"
import { runSettingsMigrations } from "@features/settings/actions/runMigrations"
import { ProviderSettingsManager } from "./features/settings/models/ProviderSettingsManager"
import { EventBridge } from "./features/foundation/webview/EventBridge"
import { DIFF_VIEW_URI_SCHEME_JABBERWOCK } from "./integrations/editor/DiffViewProvider"
import { TerminalRegistry } from "./integrations/terminal/TerminalRegistry"
import { openAiCodexOAuthManager } from "./integrations/openai-codex/oauth"
import {
	McpServerManager,
	createMcpServerManager,
	hasMcpServerManager,
	getMcpServerManager,
} from "./services/mcp/McpServerManager"
import type { DevtoolBridgeProvider } from "@jabberwock/devtool"
import {
	getCodeIndexManager,
	getAllCodeIndexManagers,
	disposeAllCodeIndexManagers,
} from "./services/code-index/manager"
import { MdmService } from "./services/mdm/MdmService"
import { migrateSettings } from "./utils/migrateSettings"
import { autoImportSettings } from "./utils/autoImportSettings"
import { EventEmitter } from "events"
import { startNewTask, createTaskWithHistoryItem } from "./features/chat/task/actions/startTask"
import { resumeTask } from "./features/chat/task/actions/resumeTask"
import { isTaskInHistory, getCurrentTaskStack } from "./features/chat/task/actions/taskRegistry"
import { popTaskFromStack, abortRunningTask } from "./features/chat/task/actions/abortRunningTask"
import { sendMessage } from "./features/chat/task/messages/actions/sendMessage"
import { pressPrimaryButton, pressSecondaryButton } from "./features/chat/task/notifications/actions/respondToAsk"
import { healthcheck } from "./features/foundation/window-manager/actions/ready"
import {
	getConfiguration,
	setConfiguration,
	createProviderProfile,
	updateProviderProfile,
	deleteProviderProfile,
	upsertProviderProfile,
	setActiveProfile,
} from "./features/settings/models/api-config-store"
import { getBackendRootStore } from "@features/storeSingleton"

import {
	handleUri,
	registerCommands,
	registerCodeActions,
	registerTerminalActions,
	CodeActionProvider,
} from "./activate"
import { initializeI18n } from "./i18n"
import { flushModels, initializeModelCacheRefresh, refreshModels } from "./api/providers/fetchers/modelCache"
// Dynamic imports used inside activate() to avoid circular dependency chain:
// extension.ts → settings/models/api-config-store → store.ts → settings/models/api-config-store (CIRCULAR)
// extension.ts → cloud/store → store.ts → settings/models/api-config-store → store.ts (CIRCULAR)

/**
 * Built using https://github.com/microsoft/vscode-webview-ui-toolkit
 *
 * Inspired by:
 *  - https://github.com/microsoft/vscode-webview-ui-toolkit-samples/tree/main/default/weather-webview
 *  - https://github.com/microsoft/vscode-webview-ui-toolkit-samples/tree/main/frameworks/hello-world-react-cra
 */

let outputChannel: vscode.OutputChannel
let extensionContext: vscode.ExtensionContext

// Bridge between activate() and deactivate() for non-serializable service instances
let _cloudService: Awaited<ReturnType<typeof createCloudService>> | undefined
let _authStateChangedHandler: ((data: { state: AuthState; previousState: AuthState }) => Promise<void>) | undefined
let _settingsUpdatedHandler: (() => void) | undefined
let _userInfoHandler: ((data: { userInfo: CloudUserInfo }) => Promise<void>) | undefined

/**
 * Check if we should auto-open the Jabberwock sidebar after switching to a worktree.
 * This is called during extension activation to handle the worktree auto-open flow.
 */
async function checkWorktreeAutoOpen(
	context: vscode.ExtensionContext,
	outputChannel: vscode.OutputChannel,
): Promise<void> {
	try {
		const worktreeAutoOpenPath = context.globalState.get<string>("worktreeAutoOpenPath")
		if (!worktreeAutoOpenPath) {
			return
		}

		const workspaceFolders = vscode.workspace.workspaceFolders
		if (!workspaceFolders || workspaceFolders.length === 0) {
			return
		}

		const currentPath = workspaceFolders[0].uri.fsPath

		// Normalize paths for comparison
		const normalizePath = (p: string) => p.replace(/\/+$/, "").replace(/\\+/g, "/").toLowerCase()

		// Check if current workspace matches the worktree path
		if (normalizePath(currentPath) === normalizePath(worktreeAutoOpenPath)) {
			// Clear the state first to prevent re-triggering
			await context.globalState.update("worktreeAutoOpenPath", undefined)

			outputChannel.appendLine(`[Worktree] Auto-opening Jabberwock sidebar for worktree: ${worktreeAutoOpenPath}`)

			// Open the Jabberwock sidebar with a slight delay to ensure UI is ready
			setTimeout(async () => {
				try {
					await vscode.commands.executeCommand("jabberwock.plusButtonClicked")
				} catch (error) {
					outputChannel.appendLine(
						`[Worktree] Error auto-opening sidebar: ${error instanceof Error ? error.message : String(error)}`,
					)
				}
			}, 500)
		}
	} catch (error) {
		outputChannel.appendLine(
			`[Worktree] Error checking worktree auto-open: ${error instanceof Error ? error.message : String(error)}`,
		)
	}
}

// This method is called when your extension is activated.
// Your extension is activated the very first time the command is executed.
/**
 * Adapter to widen EventBridge to DevtoolBridgeProvider for the DevTool bridge factory.
 *
 * DOM interaction methods (findElement, setDomRequestCallback, setActivePageRequestCallback)
 * are implemented INLINE using MST getBackendRootStore() and EventBridge.postMessageToWebview()
 * rather than living on EventBridge itself -- those are devtool package concerns.
 */
function toDevtoolBridgeProvider(provider: EventBridge): DevtoolBridgeProvider {
	const rootStore = () => getBackendRootStore()

	return {
		getActivePage: (requestId: string) => {
			provider.postMessageToWebview({
				type: "action",
				action: "getActivePage",
				requestId,
			} as import("./features/foundation/window-manager/store").WebviewOutboundMessage)
		},
		findElement: async (selector: string, depth?: number, maxChildren?: number, command?: string) => {
			const wm = rootStore().foundation.windowManager
			const requestId = Math.random().toString(36).substring(7)

			return new Promise<string>((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error(`Timeout waiting for DOM response (findElement, req: ${requestId})`))
				}, 10000)

				wm.setDomRequestCallback(
					requestId,
					(result: string) => {
						clearTimeout(timeout)
						resolve(result)
					},
					command ?? "findElementById",
					{ selector, depth, maxChildren, command },
				)

				provider.postMessageToWebview({
					type: "action",
					action: command ?? "findElementById",
					requestId,
					selector,
					depth: depth ?? 0,
					maxChildren: maxChildren ?? 0,
				})
			})
		},

		getModes: () => {
			// TODO(phase-2): read modes from MST store
			return [] as string[]
		},

		postMessageToWebview: (type: string, payload?: Record<string, unknown>) => {
			provider.postMessageToWebview({
				type,
				...payload,
			} as import("./features/foundation/window-manager/store").WebviewOutboundMessage)
		},

		setDomRequestCallback: (requestId: string, callback: (result: string) => void) => {
			const wm = rootStore().foundation.windowManager
			wm.setDomRequestCallback(requestId, callback, "dom-request-callback", { requestId })
		},

		setActivePageRequestCallback: (requestId: string, callback: (result: string) => void) => {
			rootStore().foundation.windowManager.setActivePageRequestCallback(requestId, callback)
		},

		getMode: () => {
			// TODO(phase-2): read mode from MST store
			return "unknown"
		},

		getTaskWithId: undefined,
	}
}

export async function activate(context: vscode.ExtensionContext) {
	// Isolate MobX global state to prevent conflicts with other extensions
	// that bundle their own MobX version (e.g., vsls-contrib.codetour).
	configure({ isolateGlobalState: true })

	extensionContext = context
	outputChannel = vscode.window.createOutputChannel(Package.outputChannel)
	context.subscriptions.push(outputChannel)
	outputChannel.appendLine(`${Package.name} extension activated - ${JSON.stringify(Package)}`)

	// Initialize network proxy configuration early, before any network requests.
	// When proxyUrl is configured, all HTTP/HTTPS traffic will be routed through it.
	// Only applied in debug mode (F5).
	await initializeNetworkProxy(context, outputChannel)

	// Set extension path for custom tool registry to find bundled esbuild
	customToolRegistry.setExtensionPath(context.extensionPath)

	// Migrate old settings to new
	await migrateSettings(context, outputChannel)

	// Initialize telemetry service.
	const telemetryService = createTelemetryService()

	try {
		telemetryService.register(new PostHogTelemetryClient())
	} catch (error) {
		console.warn("[jabberwock] Failed to register PostHogTelemetryClient:", error)
	}

	// Create logger for cloud services.
	const cloudLogger = createDualLogger(createOutputChannelLogger(outputChannel))

	// Initialize MDM service
	const mdmService = new MdmService(cloudLogger)
	await mdmService.initialize()

	// Initialize i18n for internationalization support.
	initializeI18n(context.globalState.get("language") ?? formatLanguage(vscode.env.language))

	// Initialize terminal shell execution handlers.
	TerminalRegistry.initialize()

	// Initialize OpenAI Codex OAuth manager for ChatGPT subscription-based access.
	openAiCodexOAuthManager.initialize(context, (message) => outputChannel.appendLine(message))

	// Get default commands from configuration.
	const defaultCommands = vscode.workspace.getConfiguration(Package.name).get<string[]>("allowedCommands") || []

	// Initialize global state if not already set.
	if (!context.globalState.get("allowedCommands")) {
		context.globalState.update("allowedCommands", defaultCommands)
	}

	initVscodeContext(context)
	await runSettingsMigrations(context)

	// Initialize code index managers for all workspace folders.
	if (vscode.workspace.workspaceFolders) {
		for (const folder of vscode.workspace.workspaceFolders) {
			const manager = getCodeIndexManager(context, folder.uri.fsPath)

			if (manager) {
				// Initialize in background; do not block extension activation
				void manager.initialize(getVscodeContext()).catch((error) => {
					const message = error instanceof Error ? error.message : String(error)
					outputChannel.appendLine(
						`[CodeIndexManager] Error during background CodeIndexManager configuration/indexing for ${folder.uri.fsPath}: ${message}`,
					)
				})

				context.subscriptions.push(manager)
			}
		}
	}

	// Initialize the provider *before* the Jabberwock Cloud service.
	const provider = new EventBridge(context, outputChannel, "sidebar", mdmService)

	// Initialize the backend MST RootStore (unconditionally).
	// Must happen BEFORE any getBackendRootStore() / getWindowManagerState() call,
	// as resolveWebviewView → getWindowManagerState → getState → getBackendRootStore()
	// throws if createBackendRootStore() was never called.
	const { createBackendRootStore: initRootStore } = await import("./features/store")
	initRootStore({ context })
	console.log("[extension] Backend MST RootStore initialized")

	// ── Register IntentBus handlers ─────────────────────────────────
	// After the root store is created, the IntentBus singleton is available
	// for feature handlers to register on.
	const { getIntentBus } = await import("./features/store")
	const intentsBus = getIntentBus()
	if (intentsBus) {
		const { registerOnTaskIntents } = await import("./features/chat/task/events/handlers/index.ts")
		const { registerOnMessagesIntents } = await import("./features/chat/task/messages/events/handlers/index.ts")
		const { registerOnNotificationsIntents } = await import(
			"./features/chat/task/notifications/events/handlers/index.ts"
		)
		const { registerOnSettingsIntents } = await import("./features/settings/events/handlers/index.ts")
		const { registerOnWindowManagerIntents } = await import(
			"./features/foundation/window-manager/events/handlers/index.ts"
		)
		const { registerOnContextManagementIntents } = await import(
			"./features/foundation/time-machine/file-context/events/handlers/index.ts"
		)
		const { registerOnCloudIntents } = await import("./features/cloud/events/handlers/index.ts")
		const { registerOnHistoryIntents } = await import("./features/history/events/handlers/index.ts")
		const { registerOnMarketplaceIntents } = await import("./features/marketplace/events/handlers/index.ts")

		registerOnTaskIntents(intentsBus)
		registerOnMessagesIntents(intentsBus)
		registerOnNotificationsIntents(intentsBus)
		registerOnSettingsIntents(intentsBus)
		registerOnWindowManagerIntents(intentsBus)
		registerOnContextManagementIntents(intentsBus)
		registerOnCloudIntents(intentsBus)
		registerOnHistoryIntents(intentsBus)
		registerOnMarketplaceIntents(intentsBus)
		// Set the provider on the bus context so handlers can access it
		// without casting rootStore as unknown.
		intentsBus.setProvider(provider)
		console.log("[extension] IntentBus handlers registered")
	} else {
		console.warn("[extension] IntentBus not available — handlers not registered")
	}

	// ── Webview→intent routing ────────────────────────────────────────
	// webviewMessageHandler.ts now uses a dual system:
	//   1. Registration-based: features call onWebviewMessage(type, handler)
	//      to self-register their slice of webview message routing.
	//   2. Fallback: the consolidated WEBVIEW_TO_INTENT map assembled in
	//      src/features/events.ts is used as a fallback for legacy mappings.
	// Over time, all features should migrate to registration-based dispatch
	// and the WEBVIEW_TO_INTENT map should be removed.

	// Initialize the singleton McpServerManager so that webview handlers (e.g., webviewDidLaunch) can access it.
	createMcpServerManager()

	// Initialize all feature states now that the root store exists.
	// Must happen after createBackendRootStore() to avoid circular dependency
	// issues during esbuild __esm module initialization (JABBERWOCK-263).
	void provider.initFeatures().catch((error) => {
		const errorMsg = error instanceof Error ? `${error.message}\n${error.stack}` : String(error)
		outputChannel.appendLine(`[extension] Error initializing features: ${errorMsg}`)
		console.error(`[jabberwock] [extension] Error initializing features:`, error)
	})

	// Initialize the ProviderSettingsManager and assign it to the provider.
	// This enables API config persistence (save/load from VS Code secrets).
	const providerSettingsManager = new ProviderSettingsManager(context)
	setProviderSettingsManager(providerSettingsManager)
	console.log("[extension] ProviderSettingsManager created and assigned to provider")

	// Initialize modes file service and load modes into MST store.
	const {
		initModesFileService: lazyInitModesFileService,
		loadAndMergeModes,
		getCustomModesFilePath,
		getWorkspaceRoomodes,
	} = await import("./features/settings/agents/modesFileService")
	lazyInitModesFileService(context)
	await loadAndMergeModes(context)
	console.log("[extension] Modes file service initialized and modes loaded into store")

	// Set up file watchers for custom modes files.
	// When files change, dispatch SettingsModeFileChanged intent so handlers reload state.
	const settingsPath = await getCustomModesFilePath(context)
	const settingsWatcher = vscode.workspace.createFileSystemWatcher(settingsPath)
	const handleModeFileChange = async () => {
		try {
			getBackendRootStore().intentStore.createIntent({
				id: crypto.randomUUID(),
				type: IntentType.SettingsModeFileChanged,
				payload: {},
				status: IntentStatus.Queued,
				createdAt: Date.now(),
			})
		} catch (error) {
			console.error("[jabberwock] [extension] Failed to dispatch SettingsModeFileChanged intent:", error)
		}
	}
	settingsWatcher.onDidChange(handleModeFileChange)
	settingsWatcher.onDidCreate(handleModeFileChange)
	settingsWatcher.onDidDelete(handleModeFileChange)
	context.subscriptions.push(settingsWatcher)

	// Also watch workspace .jabberwockmodes file if available.
	const roomodesPath = await getWorkspaceRoomodes()
	if (roomodesPath) {
		const roomodesWatcher = vscode.workspace.createFileSystemWatcher(roomodesPath)
		roomodesWatcher.onDidChange(handleModeFileChange)
		roomodesWatcher.onDidCreate(handleModeFileChange)
		roomodesWatcher.onDidDelete(handleModeFileChange)
		context.subscriptions.push(roomodesWatcher)
	}
	console.log("[extension] File watchers for custom modes files registered")

	// Initialize DevTool WebSocket server for debugging and E2E testing.
	// The server handles DOM interaction, console/diagnostics/tracing, and state inspection.
	// `jabberwock.devtool` setting controls whether it starts (default: true).
	// NOTE: Devtool starts asynchronously to avoid blocking extension activation.
	// WebSocketClientTransport in McpHub.ts has built-in retry logic (exponential backoff,
	// up to ~31s) that handles the race condition where MCP clients try to connect
	// before the devtool server is ready.
	try {
		const devtoolEnabled = vscode.workspace.getConfiguration(Package.name).get<boolean>("devtool", true)
		if (devtoolEnabled) {
			const devtoolPort = vscode.workspace.getConfiguration(Package.name).get<number>("devtoolServerPort", 60060)
			import("@jabberwock/devtool")
				.then(
					async ({
						Devtool,
						createDevtoolBridge,
						registerDomResponseHandler,
						createFrontendBridge,
						diagnosticsManager,
					}) => {
						const [{ getSnapshot }, { getBackendRootStore }] = await Promise.all([
							import("mobx-state-tree"),
							import("@features/storeSingleton"),
						])
						const backendStore = getBackendRootStore()

						// Register domResponse handler so webview store responses reach pending DOM request callbacks
						const { onWebviewMessage } = await import(
							"./features/foundation/webview/events/handlers/on-webview-message"
						)
						registerDomResponseHandler(
							onWebviewMessage as (
								type: string,
								handler: (provider: unknown, message: Record<string, unknown>) => void,
							) => void,
							(requestId, result) => {
								backendStore.foundation.windowManager.resolveDomRequest(requestId, result)
							},
						)

						// ── FrontendBridge: communicates with webview via postMessage ──
						const devtoolProvider = toDevtoolBridgeProvider(provider)
						const frontendBridge = createFrontendBridge({
							postMessageToWebview: (message) =>
								provider.postMessageToWebview(
									message as import("./features/foundation/window-manager/store").WebviewOutboundMessage,
								),
							setDomRequestCallback: (requestId, callback) =>
								devtoolProvider.setDomRequestCallback(requestId, callback),
						})

						const bridge = createDevtoolBridge(
							devtoolProvider,
							{
								getMstStore: () =>
									getSnapshot(backendStore) as Record<string, unknown> as {
										foundation: { windowManager: Record<string, unknown> }
										chat: Record<string, unknown>
										settings: Record<string, unknown>
									},
							},
							frontendBridge,
						)
						const devtool = new Devtool(bridge, undefined, devtoolPort)
						await devtool.start()
						diagnosticsManager.registerConsoleInterceptor()
						console.log(`[extension] DevTool WebSocket server started on port ${devtoolPort}`)
						outputChannel.appendLine(
							`[DevTool] WebSocket MCP server listening on ws://127.0.0.1:${devtoolPort}/ws`,
						)
					},
				)
				.catch((err: unknown) => {
					const msg = err instanceof Error ? err.message : String(err)
					console.warn(`[jabberwock] [extension] Failed to start DevTool server:`, err)
					outputChannel.appendLine(`[DevTool] Failed to start server on port ${devtoolPort}: ${msg}`)
					vscode.window.showWarningMessage(
						`DevTool server failed to start on port ${devtoolPort}: ${msg}. ` +
							`Check that port ${devtoolPort} is not in use.`,
					)
				})
		} else {
			console.log(`[extension] DevTool disabled by setting`)
		}
	} catch (error) {
		console.warn(`[jabberwock] [extension] Error initializing DevTool:`, error)
	}

	// Initialize Jabberwock Cloud service.
	const postStateListener = async () => {
		const instance = await EventBridge.getVisibleInstance()
		if (instance) {
			const { postStateToWebviewWithoutMessages: lazyPostState } = await import(
				"./features/foundation/window-manager/store"
			)
			lazyPostState(instance)
		}
	}

	const authStateChangedHandler = async (data: { state: AuthState; previousState: AuthState }) => {
		postStateListener()

		// Handle Jabberwock models cache based on auth state (JABBERWOCK-202)
		const handleRooModelsCache = async () => {
			try {
				if (data.state === "active-session") {
					// Refresh with auth token to get authenticated models
					const sessionToken = _cloudService?.authService?.getSessionToken()
					if (sessionToken) {
						await refreshModels({
							provider: "jabberwock",
							baseUrl: process.env.JABBERWOCK_CODE_PROVIDER_URL ?? "https://api.jabberwock.com/proxy",
							apiKey: sessionToken,
						})
					}
				} else {
					// Flush without refresh on logout
					await flushModels({ provider: "jabberwock" }, false)
				}
			} catch (error) {
				cloudLogger(
					`[authStateChangedHandler] Failed to handle Jabberwock models cache: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		}

		if (data.state === "active-session" || data.state === "logged-out") {
			await handleRooModelsCache()

			// Apply stored provider model to API configuration if present
			if (data.state === "active-session") {
				try {
					const storedModel = context.globalState.get<string>("jabberwock-provider-model")
					if (storedModel) {
						cloudLogger(`[authStateChangedHandler] Applying stored provider model: ${storedModel}`)
						// Get the current API configuration name
						const currentConfigName = getVscodeContext().getGlobalState("currentApiConfigName") || "default"
						// Update it with the stored model using dynamic import to avoid circular deps
						const { upsertProviderProfile: lazyUpsert } = await import(
							"./features/settings/models/api-config-store"
						)
						await lazyUpsert(provider, currentConfigName, {
							apiProvider: "jabberwock",
							apiModelId: storedModel,
						})
						// Clear the stored model after applying
						await context.globalState.update("jabberwock-provider-model", undefined)
						cloudLogger(`[authStateChangedHandler] Applied and cleared stored provider model`)
					}
				} catch (error) {
					cloudLogger(
						`[authStateChangedHandler] Failed to apply stored provider model: ${error instanceof Error ? error.message : String(error)}`,
					)
				}
			}
		}
	}

	const settingsUpdatedHandler = async () => {
		postStateListener()
	}

	const userInfoHandler = async ({ userInfo }: { userInfo: CloudUserInfo }) => {
		postStateListener()
	}

	_authStateChangedHandler = authStateChangedHandler
	_settingsUpdatedHandler = settingsUpdatedHandler
	_userInfoHandler = userInfoHandler

	const cloudService = await createCloudService(context, cloudLogger, {
		"auth-state-changed": authStateChangedHandler,
		"settings-updated": settingsUpdatedHandler,
		"user-info": userInfoHandler,
	})

	_cloudService = cloudService

	try {
		if (cloudService.telemetryClient) {
			getTelemetryService().register(cloudService.telemetryClient)
		}
	} catch (error) {
		outputChannel.appendLine(
			`[CloudService] Failed to register TelemetryClient: ${error instanceof Error ? error.message : String(error)}`,
		)
	}

	// Add to subscriptions for proper cleanup on deactivate.
	context.subscriptions.push(cloudService)

	// Trigger initial cloud profile sync now that CloudService is ready.
	try {
		const { initializeCloudProfileSyncWhenReady: lazyInitCloud } = await import("./features/cloud/store")
		await lazyInitCloud(provider)
	} catch (error) {
		outputChannel.appendLine(
			`[CloudService] Failed to initialize cloud profile sync: ${error instanceof Error ? error.message : String(error)}`,
		)
	}

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(EventBridge.sideBarId, provider, {
			webviewOptions: { retainContextWhenHidden: true },
		}),
	)

	// Check for worktree auto-open path (set when switching to a worktree)
	await checkWorktreeAutoOpen(context, outputChannel)

	// Auto-import configuration if specified in settings.
	try {
		await autoImportSettings(outputChannel, {
			providerSettingsManager: getProviderSettingsManager()!,
			contextProxy: getSettingsAccess(),
		})
	} catch (error) {
		outputChannel.appendLine(
			`[AutoImport] Error during auto-import: ${error instanceof Error ? error.message : String(error)}`,
		)
	}

	registerCommands({ context, outputChannel, provider })

	/**
	 * We use the text document content provider API to show the left side for diff
	 * view by creating a virtual document for the original content. This makes it
	 * readonly so users know to edit the right side if they want to keep their changes.
	 *
	 * This API allows you to create readonly documents in VSCode from arbitrary
	 * sources, and works by claiming an uri-scheme for which your provider then
	 * returns text contents. The scheme must be provided when registering a
	 * provider and cannot change afterwards.
	 *
	 * Note how the provider doesn't create uris for virtual documents - its role
	 * is to provide contents given such an uri. In return, content providers are
	 * wired into the open document logic so that providers are always considered.
	 *
	 * https://code.visualstudio.com/api/extension-guides/virtual-documents
	 */
	const diffContentProvider = new (class implements vscode.TextDocumentContentProvider {
		provideTextDocumentContent(uri: vscode.Uri): string {
			return Buffer.from(uri.query, "base64").toString("utf-8")
		}
	})()

	context.subscriptions.push(
		vscode.workspace.registerTextDocumentContentProvider(DIFF_VIEW_URI_SCHEME_JABBERWOCK, diffContentProvider),
	)

	context.subscriptions.push(vscode.window.registerUriHandler({ handleUri }))

	// Register code actions provider.
	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider({ pattern: "**/*" }, new CodeActionProvider(), {
			providedCodeActionKinds: CodeActionProvider.providedCodeActionKinds,
		}),
	)

	registerCodeActions(context)
	registerTerminalActions(context)

	// Allows other extensions to activate once Jabberwock is ready.
	vscode.commands.executeCommand(`${Package.name}.activationCompleted`)

	// Implements the `JabberwockAPI` interface.
	const socketPath = process.env.JABBERWOCK_CODE_IPC_SOCKET_PATH
	const enableLogging = typeof socketPath === "string"

	// Watch the core files and automatically reload the extension host.
	if (process.env.NODE_ENV === "development") {
		const watchPaths = [
			{ path: context.extensionPath, pattern: "**/*.ts" },
			{ path: path.join(context.extensionPath, "../packages/types"), pattern: "**/*.ts" },
			{ path: path.join(context.extensionPath, "../packages/telemetry"), pattern: "**/*.ts" },
			{ path: path.join(context.extensionPath, "node_modules/@jabberwock/cloud"), pattern: "**/*" },
		]

		console.log(
			`♻️♻️♻️ Core auto-reloading: Watching for changes in ${watchPaths.map(({ path }) => path).join(", ")}`,
		)

		// Create a debounced reload function to prevent excessive reloads
		let reloadTimeout: NodeJS.Timeout | undefined
		const DEBOUNCE_DELAY = 1_000

		const debouncedReload = (uri: vscode.Uri) => {
			if (reloadTimeout) {
				clearTimeout(reloadTimeout)
			}

			console.log(`♻️ ${uri.fsPath} changed; scheduling reload...`)

			reloadTimeout = setTimeout(() => {
				console.log(`♻️ Reloading host after debounce delay...`)
				vscode.commands.executeCommand("workbench.action.reloadWindow")
			}, DEBOUNCE_DELAY)
		}

		watchPaths.forEach(({ path: watchPath, pattern }) => {
			const relPattern = new vscode.RelativePattern(vscode.Uri.file(watchPath), pattern)
			const watcher = vscode.workspace.createFileSystemWatcher(relPattern, false, false, false)

			// Listen to all change types to ensure symlinked file updates trigger reloads.
			watcher.onDidChange(debouncedReload)
			watcher.onDidCreate(debouncedReload)
			watcher.onDidDelete(debouncedReload)

			context.subscriptions.push(watcher)
		})

		// Clean up the timeout on deactivation
		context.subscriptions.push({
			dispose: () => {
				if (reloadTimeout) {
					clearTimeout(reloadTimeout)
				}
			},
		})
	}

	// Initialize background model cache refresh
	initializeModelCacheRefresh()

	// ── IPC Server ──────────────────────────────────────────────────────
	// IPC server listens for external commands (CLI, headless).
	if (socketPath) {
		const ipcLog = enableLogging
			? (...args: unknown[]) => {
					for (const arg of args) {
						outputChannel.appendLine(arg === undefined ? "undefined" : String(arg))
					}
					console.log(args)
				}
			: () => {}

		const ipc = new IpcServer(socketPath, ipcLog)
		ipc.listen()

		// Dispatch incoming IPC commands — webview creates Intents via EventBridge
		ipc.on(IpcMessageType.TaskCommand, async (_clientId, command: TaskCommand) => {
			switch (command.commandName) {
				case TaskCommandName.StartNewTask: {
					const { text, images, configuration } = command.data
					getBackendRootStore().intentStore.createIntent({
						id: crypto.randomUUID(),
						type: IntentType.TaskNewRequested,
						payload: {
							text: text ?? "",
							images: images ?? undefined,
							taskConfiguration: configuration as Record<string, unknown> | undefined,
						},
						status: IntentStatus.Queued,
						createdAt: Date.now(),
					})
					break
				}
				case TaskCommandName.CancelTask:
					getBackendRootStore().intentStore.createIntent({
						id: crypto.randomUUID(),
						type: IntentType.TaskCancelRequested,
						payload: {},
						status: IntentStatus.Queued,
						createdAt: Date.now(),
					})
					break
				case TaskCommandName.CloseTask:
					await vscode.commands.executeCommand("workbench.action.files.saveFiles")
					await vscode.commands.executeCommand("workbench.action.closeWindow")
					break
				case TaskCommandName.ResumeTask:
					getBackendRootStore().intentStore.createIntent({
						id: crypto.randomUUID(),
						type: IntentType.TaskResumeRequested,
						payload: { taskId: command.data },
						status: IntentStatus.Queued,
						createdAt: Date.now(),
					})
					break
				case TaskCommandName.SendMessage: {
					const activeTask = getBackendRootStore().chat.activeTask
					if (activeTask) {
						getBackendRootStore().intentStore.createIntent({
							id: crypto.randomUUID(),
							type: IntentType.SendMessageToAgentRequested,
							payload: {
								taskId: activeTask.taskId,
								prompt: (command.data as { text?: string }).text ?? "",
							},
							status: IntentStatus.Queued,
							createdAt: Date.now(),
						})
					}
					break
				}
				default:
					ipcLog(`[IPC] Unhandled command: ${command.commandName}`)
			}
		})
	}

	// ── Inline API ─────────────────────────────────────────────────────
	// Compose the public JabberwockAPI from feature store functions.
	// This replaces the old monolithic API class.
	const eventEmitter = new EventEmitter<JabberwockAPIEvents>()

	const api: JabberwockAPI = Object.assign(eventEmitter, {
		// Task management
		startNewTask: (opts: {
			configuration?: JabberwockSettings
			text?: string
			images?: string[]
			newTab?: boolean
		}) =>
			startNewTask(provider, context, outputChannel, {
				configuration: opts.configuration ?? ({} as JabberwockSettings),
				text: opts.text,
				images: opts.images,
				newTab: opts.newTab,
			}),

		resumeTask: async (taskId: string) => {
			const { getTaskWithId } = await import("./features/history/actions")
			const historyItem = await getTaskWithId(provider, taskId)
			if (historyItem) {
				await createTaskWithHistoryItem(provider, historyItem)
			}
		},
		isTaskInHistory: (taskId: string) => isTaskInHistory(provider, taskId),
		getCurrentTaskStack: () => getCurrentTaskStack(),
		popTaskFromStack: (lastMessage?: string) => popTaskFromStack(provider, lastMessage),
		abortRunningTask: () => abortRunningTask(provider),
		sendMessage: (text?: string, images?: string[]) => sendMessage(provider, text, images),
		pressPrimaryButton: () => pressPrimaryButton(provider),
		pressSecondaryButton: () => pressSecondaryButton(provider),
		healthcheck: () => healthcheck(),

		// Configuration management
		getConfiguration: () => getConfiguration(provider),
		setConfiguration: (values: JabberwockSettings) => setConfiguration(provider, values),

		// Profile management — read from MST store state (sync) to match JabberwockAPI interface
		getProfiles: () => {
			const state = getBackendRootStore() as {
				settings?: { apiConfig?: { listApiConfigMeta?: Array<{ name: string }> } }
			}
			return state.settings?.apiConfig?.listApiConfigMeta?.map((m) => m.name) ?? []
		},
		getProfileEntry: (name: string) => {
			const state = getBackendRootStore() as {
				settings?: {
					apiConfig?: {
						listApiConfigMeta?: Array<{ name: string; id: string; apiProvider?: string; modelId?: string }>
					}
				}
			}
			return state.settings?.apiConfig?.listApiConfigMeta?.find((m) => m.name === name) as
				| ProviderSettingsEntry
				| undefined
		},
		createProfile: (name: string, profile?: ProviderSettings, activate?: boolean) =>
			createProviderProfile(provider, name, profile as Record<string, unknown> | undefined, activate),
		updateProfile: (name: string, profile: ProviderSettings, activate?: boolean) =>
			updateProviderProfile(provider, name, profile as Record<string, unknown>, activate),
		upsertProfile: (name: string, profile: ProviderSettings, activate?: boolean) =>
			upsertProviderProfile(provider, name, profile as Record<string, unknown>, activate),
		deleteProfile: (name: string) => deleteProviderProfile(provider, { name }),
		getActiveProfile: () => {
			const state = getBackendRootStore() as { settings?: { apiConfig?: { currentConfigName?: string } } }
			return state.settings?.apiConfig?.currentConfigName
		},
		setActiveProfile: (name: string) => setActiveProfile(provider, name),
	})

	return api
}

// This method is called when your extension is deactivated.
export async function deactivate() {
	outputChannel.appendLine(`${Package.name} extension deactivated`)

	// NOTE: We do NOT stop the Devtool WebSocket server here.
	//
	// On HMR, the deactivate() is called but the snapshot in context.globalState
	// persists, so the MST BackendRootStore state survives. The WsMcpServer
	// handles HMR internally — it reuses the existing WebSocketServer instance
	// when start() is called again.
	//
	// On a full process exit (F5 restart), the OS releases the socket automatically,
	// and the EADDRINUSE retry loop handles the brief TIME_WAIT window.

	if (_cloudService && hasCloudService()) {
		try {
			if (_authStateChangedHandler) {
				getCloudService().off("auth-state-changed", _authStateChangedHandler)
			}

			if (_settingsUpdatedHandler) {
				getCloudService().off("settings-updated", _settingsUpdatedHandler)
			}

			if (_userInfoHandler) {
				getCloudService().off("user-info", _userInfoHandler as (...args: unknown[]) => void)
			}

			outputChannel.appendLine("CloudService event handlers cleaned up")
		} catch (error) {
			outputChannel.appendLine(
				`Failed to clean up CloudService event handlers: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	if (hasMcpServerManager()) {
		await getMcpServerManager().cleanup(extensionContext)
	}
	if (hasTelemetryService()) {
		getTelemetryService().shutdown()
	}
	TerminalRegistry.cleanup()
}
