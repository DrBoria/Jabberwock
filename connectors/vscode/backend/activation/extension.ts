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
import { createCloudService, getCloudService, hasCloudService } from "@jabberwock/cloud"

import { Package } from "@shared/package"
import { getSettingsAccess } from "@utils/settings"
import { autoImportSettings } from "@utils/settings/autoImportSettings"
import { EventBridge } from "@features/foundation/webview/EventBridge"
import { DIFF_VIEW_URI_SCHEME_JABBERWOCK } from "@integrations/editor/DiffViewProvider"
import { hasMcpServerManager, getMcpServerManager } from "@services/mcp/core/McpServerManager"
import { initializeModelCacheRefresh } from "@api/providers/fetchers/modelCache"
import { TerminalRegistry } from "@integrations/terminal/TerminalRegistry"
import {
	handleUri,
	registerCommands,
	registerCodeActions,
	registerTerminalActions,
	CodeActionProvider,
} from "./"
import {
	setProviderSettingsManager,
	getProviderSettingsManager,
	ProviderSettingsManager,
} from "@features/settings/models/provider-settings-manager"
import { initializeStoreApiConfig } from "@features/chat/task/handlers/on-webview-launched/webview-api-config"
import { createMcpServerManager } from "@services/mcp/core/McpServerManager"
import { initializeCoreSetup, initializeCodeIndexManagers } from "@extension-activation/modules/core/core"
import { setupIntentBus } from "@extension-activation/modules/core/intents"
import { setupAgentsFileService } from "@extension-activation/modules/services/agents"
import { setupDevtool } from "@extension-activation/modules/core/devtool"
import {
	setupCloudService,
	getAuthStateChangedHandler,
	getSettingsUpdatedHandler,
	getUserInfoHandler,
} from "@extension-activation/modules/services/cloud"
import { setupIpcServer } from "@extension-activation/modules/services/ipc"
import { setProvider, setConnector } from "@features/foundation/webview/providerRegistry"
import { VscodeWebviewBackendConnector } from "@connectors/vscode/backend/connector"
import { drainQueueToResolver, wireInboundToQueue } from "@features/foundation/webview/inbound-wiring"
import { webviewMessageHandler } from "@features/foundation/webview/events/handlers/on-webview-message"
import { installExtensionCapabilities } from "@features/foundation/capabilities/bootstrap"
import { NOTIFICATION_ERROR_TOPIC } from "@features/foundation/capabilities/notifications"
import type { NotificationErrorPayload } from "@features/foundation/capabilities/pubsub"
import { setBackendCapabilities } from "@features/foundation/capabilities/registry"
import { createBackendRootStore } from "@features/store"
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
	})
	setBackendCapabilities(capabilities)

	// v4 B2 (L12): host sink for the transport-agnostic error-notification stream — renders pubsub
	// `notification.error` payloads as native vscode toasts. Replaced by VscodeWebviewBackendConnector in Phase B3 (§4.2).
	capabilities.pubsub.subscribe(NOTIFICATION_ERROR_TOPIC, (payload) => {
		const notification = payload as NotificationErrorPayload
		vscode.window.showErrorMessage(notification.message) // details stay on the console — matches pre-conversion toast behavior
	})

	const connector = new VscodeWebviewBackendConnector(context, outputChannel)
	await connector.start(capabilities) // §4.2 contract — capabilities handed to the active connector at bootstrap

	const { telemetryService, cloudLogger } = await initializeCoreSetup(context, outputChannel)

	initializeCodeIndexManagers(context, outputChannel)

	const provider = new EventBridge(connector, capabilities)

	setProvider(provider)
	setConnector(connector)
	activeConnector = connector

	// v4 B3 (§4.2/§4.6): inbound webview messages → capabilities.queue → drain → existing resolver.
	wireInboundToQueue(connector, capabilities.queue)
	void drainQueueToResolver(capabilities.queue, (item) => webviewMessageHandler(provider, item.body))

	createBackendRootStore({ globalStoragePath: context.globalStorageUri.fsPath })

	await setupIntentBus(provider, telemetryService)

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

	return buildApi(provider, context, outputChannel)
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
		await activeConnector.stop().catch((error) => outputChannel.appendLine(`[extension] connector stop failed: ${String(error)}`))
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
