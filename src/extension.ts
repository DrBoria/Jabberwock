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
		console.warn("Failed to load environment variables:", e)
	}
}

import type { CloudUserInfo, AuthState, JabberwockAPIEvents } from "@jabberwock/types"
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
import { formatLanguage } from "./shared/language"
import { ContextProxy } from "./core/config/ContextProxy"
import { ProviderSettingsManager } from "./core/config/ProviderSettingsManager"
import { EventBridge } from "./core/webview/EventBridge"
import { DIFF_VIEW_URI_SCHEME } from "./integrations/editor/DiffViewProvider"
import { TerminalRegistry } from "./integrations/terminal/TerminalRegistry"
import { openAiCodexOAuthManager } from "./integrations/openai-codex/oauth"
import { McpServerManager, createMcpServerManager } from "./services/mcp/McpServerManager"
import type { DevtoolBridgeProvider } from "@jabberwock/devtool"
import {
	getCodeIndexManager,
	getAllCodeIndexManagers,
	disposeAllCodeIndexManagers,
} from "./services/code-index/manager"
import { MdmService } from "./services/mdm/MdmService"
import { migrateSettings } from "./utils/migrateSettings"
import { autoImportSettings } from "./utils/autoImportSettings"
import { createJabberwockApi } from "./extension/jabberwock-api-factory"
import { registerIpcListeners } from "./features/ipc/listeners"

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
// extension.ts → settings/api-config/store → store.ts → settings/api-config/store (CIRCULAR)
// extension.ts → cloud/store → store.ts → settings/api-config/store → store.ts (CIRCULAR)
import { setServiceRegistry } from "./features/core/ServiceRegistry"

/**
 * Built using https://github.com/microsoft/vscode-webview-ui-toolkit
 *
 * Inspired by:
 *  - https://github.com/microsoft/vscode-webview-ui-toolkit-samples/tree/main/default/weather-webview
 *  - https://github.com/microsoft/vscode-webview-ui-toolkit-samples/tree/main/frameworks/hello-world-react-cra
 */

let outputChannel: vscode.OutputChannel
let extensionContext: vscode.ExtensionContext

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
/** Adapter to widen EventBridge to DevtoolBridgeProvider for the DevTool bridge factory. */
function toDevtoolBridgeProvider(provider: EventBridge): DevtoolBridgeProvider {
	return {
		findElement: (selector, depth, maxChildren, command) =>
			provider.findElement(selector, depth, maxChildren, command),
		getModes: () => provider.getModes(),
		postMessageToWebview: (message) => provider.postMessageToWebview(message),
		setDomRequestCallback: (requestId, callback) => provider.setDomRequestCallback(requestId, callback),
		setActivePageRequestCallback: (requestId, callback) =>
			provider.setActivePageRequestCallback(requestId, callback),
		getMode: () => provider.getMode(),
		getTaskWithId: (id) => provider.getTaskWithId(id),
		chatStore: provider.chatStore ? ({ ...provider.chatStore } as Record<string, unknown>) : undefined,
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
		console.warn("Failed to register PostHogTelemetryClient:", error)
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

	const contextProxy = await ContextProxy.getInstance(context)

	// Initialize code index managers for all workspace folders.
	if (vscode.workspace.workspaceFolders) {
		for (const folder of vscode.workspace.workspaceFolders) {
			const manager = getCodeIndexManager(context, folder.uri.fsPath)

			if (manager) {
				// Initialize in background; do not block extension activation
				void manager.initialize(contextProxy).catch((error) => {
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
	const provider = new EventBridge(context, outputChannel, "sidebar", contextProxy, mdmService)

	// Initialize the MST ChatStore for task tree tracking and devtool inspection.
	const { ChatStore } = await import("./core/state/ChatTreeStore")
	provider.chatStore = ChatStore.create({ nodes: {} })
	console.log("[extension] ChatStore created and assigned to provider")

	// Initialize the backend MST RootStore (unconditionally).
	// Must happen BEFORE any getState() / getWindowManagerState() call,
	// as resolveWebviewView → getWindowManagerState → getState → getBackendRootStore()
	// throws if createBackendRootStore() was never called.
	const { createBackendRootStore: initRootStore } = await import("./features/store")
	initRootStore({ context })
	console.log("[extension] Backend MST RootStore initialized")

	// Initialize the singleton McpServerManager so that webview handlers (e.g., webviewDidLaunch) can access it.
	createMcpServerManager()

	// Initialize all feature states now that the root store exists.
	// Must happen after createBackendRootStore() to avoid circular dependency
	// issues during esbuild __esm module initialization (JABBERWOCK-263).
	void provider.initFeatures().catch((error) => {
		const errorMsg = error instanceof Error ? `${error.message}\n${error.stack}` : String(error)
		outputChannel.appendLine(`[extension] Error initializing features: ${errorMsg}`)
		console.error(`[extension] Error initializing features:`, error)
	})

	// Push ChatStore snapshots to the webview via MstBridge so the frontend
	// chatTreeStore stays in sync via applySnapshot.
	;(await import("mobx-state-tree")).onSnapshot(provider.chatStore, (snapshot: Record<string, unknown>) => {
		provider.postMessageToWebview({
			type: "mst-snapshot-batch",
			payload: {
				snapshots: [{ storeName: "ChatStore", snapshot }],
			},
		})
	})

	// Initialize the ProviderSettingsManager and assign it to the provider.
	// This enables API config persistence (save/load from VS Code secrets).
	const providerSettingsManager = new ProviderSettingsManager(context)
	provider.providerSettingsManager = providerSettingsManager
	console.log("[extension] ProviderSettingsManager created and assigned to provider")

	// Initialize CustomModesManager for custom mode management.
	const { CustomModesManager } = await import("./core/config/CustomModesManager")
	provider.customModesManager = new CustomModesManager(context, async () => {
		const { postStateToWebviewWithoutClineMessages: lazyPostState } = await import(
			"./features/foundation/window-manager/store"
		)
		await lazyPostState(provider)
	})
	console.log("[extension] CustomModesManager created and assigned to provider")

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
			const devtoolPort = vscode.workspace.getConfiguration().get<number>("debugmcp.serverPort", 60060)
			import("@jabberwock/devtool")
				.then(async ({ Devtool, createDevtoolBridge }) => {
					const [{ getSnapshot }, { getBackendRootStore }, { getActionBuffer }] = await Promise.all([
						import("mobx-state-tree"),
						import("./features/storeSingleton"),
						import("./features/store"),
					])
					const backendStore = getBackendRootStore()

					const bridge = createDevtoolBridge(toDevtoolBridgeProvider(provider), undefined, {
						getSnapshot: () => getSnapshot(backendStore) as Record<string, unknown>,
						getActionBuffer: () => getActionBuffer(),
					})
					const devtool = new Devtool(bridge, undefined, devtoolPort)
					await devtool.start()
					console.log(`[extension] DevTool WebSocket server started on port ${devtoolPort}`)
					outputChannel.appendLine(
						`[DevTool] WebSocket MCP server listening on ws://127.0.0.1:${devtoolPort}/ws`,
					)
				})
				.catch((err: unknown) => {
					const msg = err instanceof Error ? err.message : String(err)
					console.warn(`[extension] Failed to start DevTool WebSocket server:`, err)
					outputChannel.appendLine(
						`[DevTool] Failed to start WebSocket server on port ${devtoolPort}: ${msg}`,
					)
					vscode.window.showWarningMessage(
						`DevTool WebSocket server failed to start on port ${devtoolPort}: ${msg}. ` +
							`Check that port ${devtoolPort} is not in use.`,
					)
				})
		} else {
			console.log(`[extension] DevTool disabled by setting`)
		}
	} catch (error) {
		console.warn(`[extension] Error initializing DevTool:`, error)
	}

	// Initialize Jabberwock Cloud service.
	const postStateListener = async () => {
		const instance = await EventBridge.getVisibleInstance()
		if (instance) {
			const { postStateToWebviewWithoutClineMessages: lazyPostState } = await import(
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
					const svcReg = (await import("./features/core/ServiceRegistry")).getServiceRegistry()
					const sessionToken = svcReg.cloudService?.authService?.getSessionToken()
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
						const currentConfigName =
							provider.contextProxy.getGlobalState("currentApiConfigName") || "default"
						// Update it with the stored model using dynamic import to avoid circular deps
						const { upsertProviderProfile: lazyUpsert } = await import(
							"./features/settings/api-config/store"
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

	setServiceRegistry({
		authStateChangedHandler,
		settingsUpdatedHandler,
		userInfoHandler,
	})

	const cloudService = await createCloudService(context, cloudLogger, {
		"auth-state-changed": authStateChangedHandler,
		"settings-updated": settingsUpdatedHandler,
		"user-info": userInfoHandler,
	})

	setServiceRegistry({ cloudService })
	// Notify store that cloud service is available
	const { getBackendRootStore } = await import("./features/storeSingleton")
	getBackendRootStore().core.setCloudServiceAvailable(true)

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

	// Finish initializing the provider.
	getTelemetryService().setProvider(provider)

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
			providerSettingsManager: provider.providerSettingsManager,
			contextProxy: provider.contextProxy,
			customModesManager: provider.customModesManager,
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
		vscode.workspace.registerTextDocumentContentProvider(DIFF_VIEW_URI_SCHEME, diffContentProvider),
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

	// ── IPC Server & Event Broadcasting ────────────────────────────────
	// IPC server listens for external commands (CLI, headless) and
	// broadcasts task events to IPC clients.
	let emit: <K extends keyof JabberwockAPIEvents>(eventName: K, ...args: JabberwockAPIEvents[K]) => void = () => {}

	if (socketPath) {
		const ipcResult = registerIpcListeners(provider, context, outputChannel, socketPath, enableLogging)
		emit = ipcResult.emit
	}

	// ── Public API ─────────────────────────────────────────────────────
	// Compose the public JabberwockAPI from feature store functions.
	// This replaces the old monolithic API class.
	return createJabberwockApi({ outputChannel, provider, context, emit })
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

	const svcReg = (await import("./features/core/ServiceRegistry")).getServiceRegistry()
	const cloudService = svcReg.cloudService
	if (cloudService && hasCloudService()) {
		try {
			if (svcReg.authStateChangedHandler) {
				getCloudService().off("auth-state-changed", svcReg.authStateChangedHandler)
			}

			if (svcReg.settingsUpdatedHandler) {
				getCloudService().off("settings-updated", svcReg.settingsUpdatedHandler)
			}

			if (svcReg.userInfoHandler) {
				getCloudService().off("user-info", svcReg.userInfoHandler as (...args: unknown[]) => void)
			}

			outputChannel.appendLine("CloudService event handlers cleaned up")
		} catch (error) {
			outputChannel.appendLine(
				`Failed to clean up CloudService event handlers: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	const mcpManager = svcReg.mcpManager
	if (mcpManager) {
		await mcpManager.cleanup(extensionContext)
	}
	if (hasTelemetryService()) {
		getTelemetryService().shutdown()
	}
	TerminalRegistry.cleanup()
}
