import * as vscode from "vscode"
import * as dotenvx from "@dotenvx/dotenvx"
import * as fs from "fs"
import * as path from "path"

// Load environment variables from .env file
const envPath = path.join(__dirname, "..", ".env")
if (fs.existsSync(envPath)) {
	try {
		dotenvx.config({ path: envPath })
	} catch (e) {
		console.warn("[jabberwock] Failed to load environment variables:", e)
	}
}

import { hasTelemetryService, getTelemetryService } from "@jabberwock/telemetry"
import { createCloudService, getCloudService, hasCloudService, setVscodeModule } from "@jabberwock/cloud"
import type { ICheckpointDiffEntry } from "@jabberwock/types"

import { Package } from "@shared/package"
import { getSettingsAccess } from "@utils/settings"
import { arePathsEqual } from "@utils/io/path"
import { autoImportSettings } from "@utils/settings/autoImportSettings"
import { EventBridge } from "@features/foundation/webview/EventBridge"
import {
	DIFF_VIEW_URI_SCHEME_JABBERWOCK,
	DiffViewProvider,
} from "@connectors/vscode/backend/integrations/editor/DiffViewProvider"
import { getTheme } from "@connectors/vscode/backend/integrations/theme/getTheme"
import { hasMcpServerManager, getMcpServerManager } from "@services/mcp/core/McpServerManager"
import { initializeModelCacheRefresh } from "@api/providers/fetchers/modelCache"
import { TerminalRegistry } from "@connectors/vscode/backend/integrations/terminal/TerminalRegistry"
import { Terminal } from "@connectors/vscode/backend/integrations/terminal/terminal-core/Terminal"
import { handleUri, registerCommands, registerCodeActions, registerTerminalActions, CodeActionProvider } from "./"
import { openClineInNewTab } from "./registerCommands/open-in-new-tab"
import {
	setProviderSettingsManager,
	getProviderSettingsManager,
	ProviderSettingsManager,
} from "@features/settings/models/provider-settings-manager"
import { initializeStoreApiConfig } from "@features/chat/task/handlers/on-webview-launched/webview-api-config"
import { createMcpServerManager } from "@services/mcp/core/McpServerManager"
import { initializeCoreSetup, initializeCodeIndexManagers } from "@extension-activation/modules/core/core"
import { setupAgentsFileService } from "@extension-activation/modules/services/agents"
import { setupDevtool } from "@extension-activation/modules/core/devtool"
import {
	setupCloudService,
	getAuthStateChangedHandler,
	getSettingsUpdatedHandler,
	getUserInfoHandler,
} from "@extension-activation/modules/services/cloud"
import { setupIpcServer } from "@extension-activation/modules/services/ipc"
import { startBackend } from "@startup/bootstrap"
import { registerProvider } from "@api/providers/registry"
import { VsCodeLmHandler } from "@connectors/vscode/backend/model-providers/vscode-lm"
import { getVsCodeLmModels } from "@connectors/vscode/backend/model-providers/vscode-lm/tools"
import { VscodeWebviewBackendConnector } from "@connectors/vscode/backend/connector"
import { VscodeFileWatcherFactory } from "@connectors/vscode/backend/file-watcher"
import { installExtensionCapabilities } from "@features/foundation/capabilities/bootstrap"
import { NOTIFICATION_ERROR_TOPIC } from "@features/foundation/capabilities/notifications"
import type { NotificationErrorPayload } from "@features/foundation/capabilities/pubsub"
import { setBackendCapabilities } from "@features/foundation/capabilities/registry"
import { getContextArchiveReady, syncContextWindowMetaToStore } from "@features/context"
import { buildApi, setupDevWatchers } from "@extension-activation/modules/core/api"
import { checkWorktreeAutoOpen } from "@extension-activation/modules/services/worktree"

let outputChannel: vscode.OutputChannel
let extensionContext: vscode.ExtensionContext

let _cloudService: Awaited<ReturnType<typeof createCloudService>> | undefined

export async function activate(context: vscode.ExtensionContext) {
	extensionContext = context
	outputChannel = vscode.window.createOutputChannel(Package.outputChannel)
	context.subscriptions.push(outputChannel)
	outputChannel.appendLine(`${Package.name} extension activated - ${JSON.stringify(Package)}`)

	// v4 B2 (plan §7.1/§10.2): install backend capabilities + active connector BEFORE any feature code runs —
	// hashmapMemory routes through the host globalState memento, logger slot → output channel (L8),
	// and VscodeWebviewBackendConnector (connectors/vscode/backend) becomes the IBackendConnector for
	// window-manager outbound/inbound routing (§4.2).
	const workspaceRoots = vscode.workspace.workspaceFolders?.map((f) => f.uri.fsPath) ?? []
	const capabilities = installExtensionCapabilities({
		globalMemento: context.globalState,
		storageDir: context.globalStorageUri.fsPath,
		workspaceRoots,
		secrets: context.secrets,
		logSink: outputChannel,
		// v4 B2 (L6/L11): host event + version adapted into the structural capability slots.
		onWorkspaceFoldersChanged: (handler) => vscode.workspace.onDidChangeWorkspaceFolders(() => handler()),
		extensionVersion: context.extension?.packageJSON?.version ?? "0.0.0",
		// D4g (plan §3.2 Strategy G): host language — the host editor language the telemetry service
		// reports (replaces the `vscode.env.language` read in the shared backend).
		language: vscode.env.language,
		// D4g-2 (batch 1): host command adapters — the cloud OAuth flow opens external URLs through
		// this slot instead of importing "vscode" (plan §3.2 Strategy G).
		hostCommands: {
			reloadWindow: () => {
				void vscode.commands.executeCommand("workbench.action.reloadWindow")
			},
			openExternal: (url: string) => {
				void vscode.env.openExternal(vscode.Uri.parse(url))
			},
			// D4g-2 (batch 3): host command execution — the shared settings handlers run host-specific
			// commands (reveal-in-explorer, open keybindings, markdown preview, terminal focus) through
			// this slot instead of importing "vscode" (plan §3.2 Strategy G).
			executeCommand: (command: string, ...args: unknown[]) => {
				void vscode.commands.executeCommand(command, ...args)
			},
			// D4g-2 (batch 3): open a file in the host editor — the shared settings handlers open
			// temp files (debug history, diagnostics, markdown preview) through this slot instead of
			// importing "vscode" (plan §3.2 Strategy G).
			openFileInEditor: (filePath: string, options?: { preview?: boolean; line?: number }) => {
				void vscode.workspace
					.openTextDocument(filePath)
					.then((doc) => {
						const selection =
							options?.line !== undefined
								? new vscode.Selection(
										Math.max(options.line - 1, 0),
										0,
										Math.max(options.line - 1, 0),
										0,
									)
								: undefined
						return vscode.window.showTextDocument(doc, { preview: options?.preview ?? false, selection })
					})
					.catch((error) => {
						outputChannel.appendLine(`[jabberwock] openFileInEditor failed: ${String(error)}`)
					})
			},
			// D4g-2 (batch 3): open a markdown file in the host rendered-preview — the shared settings
			// handlers open the markdown preview through this slot instead of importing "vscode"
			// (plan §3.2 Strategy G).
			openMarkdownPreview: (filePath: string) => {
				void vscode.commands.executeCommand("markdown.showPreview", vscode.Uri.file(filePath))
			},
			// D4g-2 (batch 3): open a folder in the host — the worktree switch handler opens the
			// selected worktree through this slot instead of importing "vscode" (plan §3.2 Strategy G).
			openFolder: (path: string, options?: { forceNewWindow?: boolean }) => {
				void vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(path), {
					forceNewWindow: options?.forceNewWindow,
				})
			},
			// D4g-2 (batch 3): open a file with the host's default handler (e.g. an image preview) —
			// the shared image handler opens files through this slot instead of importing "vscode"
			// (plan §3.2 Strategy G).
			openWithDefaultHandler: (path: string) => {
				void vscode.commands.executeCommand("vscode.open", vscode.Uri.file(path))
			},
			// D4g-2 (batch 3): reveal a path in the host explorer — the shared open-file helper
			// reveals directories through this slot instead of importing "vscode" (plan §3.2 Strategy G).
			revealInExplorer: (path: string) => {
				void vscode.commands.executeCommand("revealInExplorer", vscode.Uri.file(path))
			},
			// D4g-2 (batch 3): close a duplicate open tab for a path — the shared open-file helper
			// closes cross-column duplicates through this slot instead of importing "vscode"
			// (plan §3.2 Strategy G). Only closes when the tab is in a different column and not dirty.
			closeDuplicateTab: (path: string) => {
				try {
					for (const group of vscode.window.tabGroups.all) {
						const existingTab = group.tabs.find(
							(tab) =>
								tab.input instanceof vscode.TabInputText && arePathsEqual(tab.input.uri.fsPath, path),
						)
						if (existingTab) {
							const activeColumn = vscode.window.activeTextEditor?.viewColumn
							const tabColumn = vscode.window.tabGroups.all.find((g) =>
								g.tabs.includes(existingTab),
							)?.viewColumn
							if (activeColumn && activeColumn !== tabColumn && !existingTab.isDirty) {
								void vscode.window.tabGroups.close(existingTab)
							}
							break
						}
					}
				} catch {
					// Tab operations sometimes fail; non-essential
				}
			},
			// D4g-2 (batch 3): capture the latest terminal output — the shared "terminal" mention
			// reads the host terminal through this slot instead of importing "vscode" (plan §3.2
			// Strategy G). The clipboard-based capture (select-all, copy, clear, read, restore) is
			// performed atomically here with proper ordering.
			getTerminalOutput: async () => {
				const originalClipboard = await vscode.env.clipboard.readText()
				try {
					await vscode.commands.executeCommand("workbench.action.terminal.selectAll")
					await vscode.commands.executeCommand("workbench.action.terminal.copySelection")
					await vscode.commands.executeCommand("workbench.action.terminal.clearSelection")
					let terminalContents = (await vscode.env.clipboard.readText()).trim()
					if (terminalContents === originalClipboard) {
						return ""
					}
					const lines = terminalContents.split("\n")
					const lastLine = lines.pop()?.trim()
					if (lastLine) {
						let i = lines.length - 1
						while (i >= 0 && !lines[i].trim().startsWith(lastLine)) {
							i--
						}
						terminalContents = lines.slice(Math.max(i, 0)).join("\n")
					}
					return terminalContents
				} finally {
					await vscode.env.clipboard.writeText(originalClipboard)
				}
			},
			// D4g-2 (batch 2): checkpoint diff view — the shared checkpoint action opens the host
			// multi-file diff view through this slot instead of importing "vscode" (plan §3.2 Strategy G).
			showCheckpointDiff: (title: string, entries: readonly ICheckpointDiffEntry[]) => {
				void vscode.commands.executeCommand(
					"vscode.changes",
					title,
					entries.map((entry) => [
						vscode.Uri.file(entry.paths.absolute),
						vscode.Uri.parse(`${DIFF_VIEW_URI_SCHEME_JABBERWOCK}:${entry.paths.relative}`).with({
							query: Buffer.from(entry.content.before).toString("base64"),
						}),
						vscode.Uri.parse(`${DIFF_VIEW_URI_SCHEME_JABBERWOCK}:${entry.paths.relative}`).with({
							query: Buffer.from(entry.content.after).toString("base64"),
						}),
					]),
				)
			},
		},
		// D4b (plan §3.2 Strategy B): configuration slot backed by the host configuration API.
		// The shared backend reads config through this slot instead of importing "vscode".
		config: {
			get: <T>(section: string, key: string, defaultValue?: T): T | undefined => {
				const configuration = vscode.workspace.getConfiguration(section)
				return defaultValue === undefined ? configuration.get<T>(key) : configuration.get<T>(key, defaultValue)
			},
			update: (section: string, key: string, value: unknown): Promise<void> =>
				vscode.workspace.getConfiguration(section).update(key, value, vscode.ConfigurationTarget.Global),
		},
		// D4c (plan §3.2 Strategy C): UI dialog slot backed by the host window dialog APIs.
		// The shared backend calls dialogs through this slot instead of importing "vscode".
		uiDialogs: {
			showOpenDialog: (options) =>
				vscode.window.showOpenDialog({
					filters: options?.filters,
					canSelectMany: options?.canSelectMany,
					// D4g-2 (batch 3): file/folder restriction + cosmetic labels forwarded to the host.
					canSelectFiles: options?.canSelectFiles,
					canSelectFolders: options?.canSelectFolders,
					openLabel: options?.openLabel,
					title: options?.title,
					defaultUri: options?.defaultUri ? vscode.Uri.file(options.defaultUri.fsPath) : undefined,
				}),
			showInputBox: (options) => vscode.window.showInputBox(options ?? {}),
			showInformationMessage: (message) => vscode.window.showInformationMessage(message),
			// D4g-2 (batch 2): optional buttons (e.g. the checkpoint "Learn More" action) are forwarded
			// to the host warning toast; the clicked button label resolves back to the caller.
			showWarningMessage: (message, buttons) => vscode.window.showWarningMessage(message, ...(buttons ?? [])),
			// D4g-2 (batch 1): save-file dialog slot — the settings export action calls this instead
			// of importing "vscode" (plan §3.2 Strategy C).
			showSaveDialog: (options) =>
				vscode.window.showSaveDialog({
					filters: options?.filters,
					// D4g-2 (batch 3): cosmetic dialog title forwarded to the host.
					title: options?.title,
					defaultUri: options?.defaultUri ? vscode.Uri.file(options.defaultUri.fsPath) : undefined,
				}),
			// D4g-2 (batch 1): confirmation dialog slot — the history state-reset handler calls this
			// instead of importing "vscode" (plan §3.2 Strategy C).
			showConfirmDialog: (options) =>
				vscode.window.showWarningMessage(
					options.message,
					{ modal: options?.modal ?? false },
					...(options?.buttons ?? []),
				),
		},
		// D4e (plan §3.2 Strategy E): application root path — the host installation directory, used to
		// locate the bundled ripgrep binary.
		appRoot: vscode.env.appRoot,
		// D4e (plan §3.2 Strategy E): open editor tab groups — the host UI concept the workspace tracker
		// reads for the "opened tabs" list. Text-document tabs only (matches the pre-D4e filter).
		tabGroups: {
			all: () =>
				vscode.window.tabGroups.all.map((group) => ({
					tabs: group.tabs
						.filter(
							(tab): tab is vscode.Tab & { input: vscode.TabInputText } =>
								tab.input instanceof vscode.TabInputText,
						)
						.map((tab) => ({
							label: tab.label,
							isActive: tab.isActive,
							path: tab.input.uri.fsPath,
						})),
				})),
			onDidChange: (handler) => vscode.window.tabGroups.onDidChangeTabs(() => handler()),
		},
		// D4e (plan §3.2 Strategy E): file-system watcher factory — the host watcher API the workspace
		// tracker uses to observe file create/delete events (server mode uses chokidar instead).
		fileWatchers: new VscodeFileWatcherFactory(),
		// D4g-2 (batch 3): host model listing — the settings models handler reads the host
		// language-model models through this slot instead of importing the vscode connector
		// (locked orchestrator decision Q1 option a). The provider argument is the host model
		// namespace ("vscode-lm"); the host API lists all selectable chat models.
		getModels: async (provider: string) => {
			if (provider !== "vscode-lm") {
				return []
			}
			const models = await getVsCodeLmModels()
			return models.map((model) => ({
				id: model.id,
				vendor: model.vendor,
				family: model.family,
				version: model.version,
			}))
		},
		// D4g-2 (batch 3): host clipboard — the shared settings handlers copy text (system prompt,
		// image paths) through this slot instead of importing "vscode" (plan §3.2 Strategy G).
		clipboard: {
			readText: () => vscode.env.clipboard.readText(),
			writeText: (text: string) => vscode.env.clipboard.writeText(text),
		},
		// D4g-2 (batch 3): host language-service diagnostics — the shared diagnostics formatter and
		// the "problems" mention read the host diagnostics through this slot instead of importing
		// "vscode" (plan §3.2 Strategy G).
		diagnostics: {
			getAll: () =>
				vscode.languages.getDiagnostics().map(([uri, diags]) => [
					{ fsPath: uri.fsPath },
					diags.map((d) => ({
						severity: d.severity,
						range: {
							start: { line: d.range.start.line, character: d.range.start.character },
							end: { line: d.range.end.line, character: d.range.end.character },
						},
						message: d.message,
						source: d.source,
					})),
				]),
		},
		// D4g-2 (batch 4): open a new webview tab — the shared task-start action opens a new tab
		// through this slot instead of importing the vscode connector's openClineInNewTab (C-2 purity).
		// The connector closes over its own context/outputChannel; the returned tab connector
		// structurally satisfies the host-neutral INewTabProvider (ProviderHandle-compatible).
		openInNewTab: () => openClineInNewTab({ context: extensionContext, outputChannel }),
		// D4g-2 (batch 4): host theme service — the shared webview-launched handler reads the host
		// theme through this slot instead of importing the vscode connector's getTheme (C-2 purity).
		hostThemeService: {
			getTheme: () => getTheme(),
		},
		// D4g-2 (batch 4): host editor service — the shared task-start action creates the diff view
		// through this slot instead of importing the vscode connector's DiffViewProvider (C-2 purity).
		hostEditorService: {
			createDiffViewProvider: (cwd: string) => new DiffViewProvider(cwd),
		},
		// D4g-2 (batch 4): host terminal service — the shared execute-command tool and the
		// condense-context terminal section use the host terminals through this slot instead of
		// importing the vscode connector's TerminalRegistry (C-2 purity). The backing wraps the
		// static TerminalRegistry methods + the static Terminal.compressTerminalOutput.
		hostTerminalService: {
			getOrCreateTerminal: (cwd, taskId, provider) => TerminalRegistry.getOrCreateTerminal(cwd, taskId, provider),
			getTerminals: (busy, taskId) => TerminalRegistry.getTerminals(busy, taskId),
			getBackgroundTerminals: (busy) => TerminalRegistry.getBackgroundTerminals(busy),
			getUnretrievedOutput: (id) => TerminalRegistry.getUnretrievedOutput(id),
			releaseTerminalsForTask: (taskId) => TerminalRegistry.releaseTerminalsForTask(taskId),
			compressTerminalOutput: (input) => Terminal.compressTerminalOutput(input),
			showTerminal: (terminal) => {
				if (terminal instanceof Terminal) {
					terminal.terminal.show(true)
				}
			},
		},
	})
	setBackendCapabilities(capabilities)

	// v4 B2 (L12): host sink for the transport-agnostic error-notification stream — renders pubsub
	// `notification.error` payloads as native vscode toasts. Replaced by VscodeWebviewBackendConnector in Phase B3 (§4.2).
	capabilities.pubsub.subscribe(NOTIFICATION_ERROR_TOPIC, (payload) => {
		const notification = payload as NotificationErrorPayload
		vscode.window.showErrorMessage(notification.message) // details stay on the console — matches pre-conversion toast behavior
	})

	const connector = new VscodeWebviewBackendConnector(context, outputChannel)

	// D4g-pre (provider-registry seam): register the host-specific vscode-lm provider before the
	// shared backend starts, so buildApiHandler resolves it via the registry (C-2: the shared
	// backend never statically imports the vscode connector).
	registerProvider("vscode-lm", VsCodeLmHandler)
	// D4g-pre (module-holder): hand the vscode module to the shared cloud package so importVscode()
	// resolves without a runtime require/import of "vscode" (C-2).
	setVscodeModule(vscode)

	// v4 C2 (§7.1): shared backend bootstrap — connector.start + EventBridge + providerRegistry
	// + inbound wiring + logger slot. The vscode-specific application composition (root store,
	// intent handlers, telemetry, cloud/devtool/agents services, commands, IpcServer) stays below
	// as the extension layer over the common core.
	const provider = await startBackend({ connector, capabilities })
	activeConnector = connector

	// D4g-2 (batch 4): terminal registry initialization moved here from core.ts (a vscode-connector
	// concern) so the shared backend does not import the connector's TerminalRegistry (which would
	// pull the vscode-importing Terminal.ts + its p-wait-for dependency into the backend tsc graph).
	TerminalRegistry.initialize()

	const { cloudLogger } = await initializeCoreSetup(context, outputChannel)

	initializeCodeIndexManagers(context, outputChannel)

	// ICG-C1 (§5.7): bootstrap's floating initContextArchive may settle before OR after the root store exists; awaiting its readiness gate (no re-reconciliation) mirrors bounded archive metadata into the new store exactly once, so devtool/store consumers see hydrated contextWindowMeta without waiting for a later ingest to retry the push.
	void getContextArchiveReady().then(() => syncContextWindowMetaToStore())

	createMcpServerManager()

	const providerSettingsManager = new ProviderSettingsManager(context)
	setProviderSettingsManager(providerSettingsManager)

	// Populate MST store's apiConfig from PSM immediately so tasks have
	// the correct API configuration at creation time, not just after webview launch.
	void initializeStoreApiConfig()

	await setupAgentsFileService(context, outputChannel)
	await setupDevtool(provider, outputChannel)

	const cloudService = await setupCloudService(context, cloudLogger, provider, outputChannel)
	_cloudService = cloudService

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(EventBridge.sideBarId, connector, {
			webviewOptions: { retainContextWhenHidden: true },
		}),
	)

	await checkWorktreeAutoOpen(context, outputChannel)

	try {
		await autoImportSettings({
			providerSettingsManager: getProviderSettingsManager()!,
			contextProxy: getSettingsAccess(),
		})
	} catch (error) {
		outputChannel.appendLine(
			`[AutoImport] Error during auto-import: ${error instanceof Error ? error.message : String(error)}`,
		)
	}

	registerCommands({ context, outputChannel, provider })

	const diffContentProvider = new (class implements vscode.TextDocumentContentProvider {
		provideTextDocumentContent(uri: vscode.Uri): string {
			return Buffer.from(uri.query, "base64").toString("utf-8")
		}
	})()

	context.subscriptions.push(
		vscode.workspace.registerTextDocumentContentProvider(DIFF_VIEW_URI_SCHEME_JABBERWOCK, diffContentProvider),
	)

	context.subscriptions.push(vscode.window.registerUriHandler({ handleUri }))

	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider({ pattern: "**/*" }, new CodeActionProvider(), {
			providedCodeActionKinds: CodeActionProvider.providedCodeActionKinds,
		}),
	)

	registerCodeActions(context)
	registerTerminalActions(context)

	vscode.commands.executeCommand(`${Package.name}.activationCompleted`)

	const socketPath = process.env.JABBERWOCK_CODE_IPC_SOCKET_PATH
	const enableLogging = typeof socketPath === "string"

	setupDevWatchers(context)
	initializeModelCacheRefresh()
	setupIpcServer(socketPath, enableLogging, outputChannel)

	return buildApi(provider)
}

let activeConnector: VscodeWebviewBackendConnector | undefined

/** Detach all registered CloudService event handlers (no-op when cloud is not active). */
function cleanupCloudServiceHandlers(): void {
	if (!(_cloudService && hasCloudService())) return

	try {
		const authStateChangedHandler = getAuthStateChangedHandler()
		const settingsUpdatedHandler = getSettingsUpdatedHandler()
		const userInfoHandler = getUserInfoHandler()

		if (authStateChangedHandler) {
			getCloudService().off("auth-state-changed", authStateChangedHandler)
		}

		if (settingsUpdatedHandler) {
			getCloudService().off("settings-updated", settingsUpdatedHandler)
		}

		if (userInfoHandler) {
			getCloudService().off("user-info", userInfoHandler as (...args: unknown[]) => void)
		}

		outputChannel.appendLine("CloudService event handlers cleaned up")
	} catch (error) {
		outputChannel.appendLine(
			`Failed to clean up CloudService event handlers: ${error instanceof Error ? error.message : String(error)}`,
		)
	}
}

export async function deactivate() {
	outputChannel.appendLine(`${Package.name} extension deactivated`)

	if (activeConnector) {
		await activeConnector
			.stop()
			.catch((error) => outputChannel.appendLine(`[extension] connector stop failed: ${String(error)}`))
		activeConnector = undefined
	}

	cleanupCloudServiceHandlers()

	if (hasMcpServerManager()) {
		await getMcpServerManager().cleanup(extensionContext)
	}

	if (hasTelemetryService()) {
		getTelemetryService().shutdown()
	}

	TerminalRegistry.cleanup()
}
