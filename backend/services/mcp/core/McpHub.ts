import { EventEmitter } from "events"

// v4 B2 (L14): protocol + structural types only — no host imports in the hub core.
import type {
	DisposableLike,
	IFileWatcher,
	McpResourceResponse,
	McpServer,
	McpToolCallResponse,
} from "@jabberwock/types"
import type { ProviderHandle } from "@features/foundation/webview/EventBridge"
import type { IExtensionContextView } from "@features/foundation/host-context/context"
import type { McpHubState } from "./types"

import { getMcpSettingsFilePath as getMcpSettingsFilePathHelper } from "@services/mcp/config"
import { getServers, getAllServers, deleteConnection } from "@services/mcp/mcp-hub/connection"
import { notifyWebviewOfServerChanges } from "@services/mcp/mcp-hub/notifications"
import { toggleServerDisabled, updateServerTimeout, updateServerConnections } from "@services/mcp/mcp-hub/server"
import { handleMcpEnabledChange, refreshAllConnections, refreshServerCapabilities } from "@services/mcp/mcp-hub/server"
import {
	callTool as callToolHelper,
	readResource as readResourceHelper,
	restartConnection,
	deleteServer,
} from "@services/mcp/mcp-hub/server"
import {
	toggleToolAlwaysAllow as toggleToolAlwaysAllowExt,
	toggleToolEnabledForPrompt as toggleToolEnabledForPromptExt,
} from "@services/mcp/mcp-hub/tool-toggle-methods"
import { setupWatchers, initializeAllServers, type HubDeps } from "@services/mcp/mcp-hub/init"
import { disposeHub } from "@services/mcp/mcp-hub/disposal"

import { getProjectMcpPath } from "@services/mcp/mcp-hub/init"

import { getMcpServersPath as getMcpServersPathFromFile } from "@services/mcp/config"

export class McpHub extends EventEmitter {
	providerRef: WeakRef<ProviderHandle>
	connections: import("./types").McpConnection[] = []
	isConnecting: boolean = false

	// v4 B2 (L14): structural types — the host context satisfies IExtensionContextView structurally.
	private _context: IExtensionContextView
	private disposables: DisposableLike[] = []
	private settingsWatcher?: IFileWatcher | undefined
	private fileWatchers: Map<string, import("chokidar").FSWatcher[]> = new Map()
	private projectMcpWatcher?: IFileWatcher | undefined
	private isDisposed: boolean = false
	private refCount: number = 0
	private configChangeDebounceTimers: Map<string, NodeJS.Timeout> = new Map()
	private isProgrammaticUpdate: boolean = false
	private flagResetTimer?: NodeJS.Timeout
	private sanitizedNameRegistry: Map<string, string> = new Map()
	private initializationPromise: Promise<void>

	private get s(): McpHubState {
		return {
			connections: this.connections,
			isConnecting: this.isConnecting,
			isProgrammaticUpdate: this.isProgrammaticUpdate,
			flagResetTimer: this.flagResetTimer,
			sanitizedNameRegistry: this.sanitizedNameRegistry,
			providerRef: this.providerRef,
			fileWatchers: this.fileWatchers,
			_context: this._context,
			configChangeDebounceTimers: this.configChangeDebounceTimers,
			isDisposed: this.isDisposed,
			refCount: this.refCount,
			disposables: this.disposables,
		}
	}

	private get hubDeps(): HubDeps {
		return {
			buildState: () => this.s,
			getMcpSettingsFilePath: () => this.getMcpSettingsFilePath(),
			getProjectMcpPath: () => getProjectMcpPath(),

			notifyWebviewOfServerChanges: () => this.notifyWebview(),
			deleteConnection: (name, source) => deleteConnection(this.s, name, source),
			updateServerConnections: (servers, source, manageState) =>
				updateServerConnections(this.s, servers, source, manageState, () => this.getMcpSettingsFilePath()),
			configChangeDebounceTimers: this.configChangeDebounceTimers,
		}
	}

	// v4 B2 (L14): structural view — real host contexts satisfy it structurally.
	constructor(provider: ProviderHandle, context: IExtensionContextView) {
		super()
		this.providerRef = new WeakRef(provider)
		this._context = context
		this.initializationPromise = this.init()
	}

	private async init(): Promise<void> {
		await setupWatchers(this.hubDeps)
		await initializeAllServers(this.hubDeps)
	}

	async waitUntilReady(): Promise<void> {
		await this.initializationPromise
	}

	registerClient(): void {
		this.refCount++
	}

	async unregisterClient(): Promise<void> {
		this.refCount--
		if (this.refCount <= 0) {
			console.log("McpHub: Last client unregistered. Disposing hub.")
			await this.dispose()
		}
	}

	getMcpSettingsFilePath(): Promise<string> {
		return getMcpSettingsFilePathHelper(this._context)
	}

	private notifyWebview(): Promise<void> {
		return notifyWebviewOfServerChanges(this.s, () => this.getMcpSettingsFilePath(), getProjectMcpPath)
	}

	getServers = (agentMcpList?: string[]): McpServer[] =>
		getServers(this.s, (_name, _config, _mcpList) => true, agentMcpList)

	getAllServers = (): McpServer[] => getAllServers(this.s)

	async getMcpServersPath(): Promise<string> {
		const provider = this.providerRef.deref()
		if (!provider) {
			throw new Error("Provider not available")
		}
		const getPath = getMcpServersPathFromFile
		return getPath(this._context.storageUri?.fsPath ?? "")
	}

	deleteConnection = (name: string, source?: "global" | "project"): Promise<void> =>
		deleteConnection(this.s, name, source)

	findServerNameBySanitizedName = (sanitizedServerName: string): string | null =>
		this.sanitizedNameRegistry.get(sanitizedServerName) ?? null

	restartConnection = (serverName: string, source?: "global" | "project"): Promise<void> =>
		restartConnection(this.s, serverName, source)

	refreshAllConnections = (): Promise<void> =>
		refreshAllConnections(
			this.s,
			() => this.getMcpSettingsFilePath(),
			(source) => this.initializeMcpServers(source),
		)

	private initializeMcpServers = (_source: "global" | "project"): Promise<void> => initializeAllServers(this.hubDeps)

	toggleServerDisabled = (serverName: string, disabled: boolean, source?: "global" | "project"): Promise<void> =>
		toggleServerDisabled(this.s, serverName, disabled, () => this.getMcpSettingsFilePath(), source)

	updateServerTimeout = (serverName: string, timeout: number, source?: "global" | "project"): Promise<void> =>
		updateServerTimeout(this.s, serverName, timeout, () => this.getMcpSettingsFilePath(), source)

	deleteServer = (serverName: string, source?: "global" | "project"): Promise<void> =>
		deleteServer(this.s, serverName, () => this.getMcpSettingsFilePath(), source)

	readResource = (serverName: string, uri: string, source?: "global" | "project"): Promise<McpResourceResponse> =>
		readResourceHelper(this.s, serverName, uri, source)

	callTool = (
		serverName: string,
		toolName: string,
		toolArguments?: Record<string, unknown>,
		source?: "global" | "project",
	): Promise<McpToolCallResponse> => callToolHelper(this.s, serverName, toolName, toolArguments, source)

	updateServerToolList = (serverName: string, source?: "global" | "project"): Promise<void> =>
		refreshServerCapabilities(this.s, serverName, source ?? "global", () => this.getMcpSettingsFilePath())

	toggleToolAlwaysAllow = (
		serverName: string,
		toolName: string,
		alwaysAllow: boolean,
		source?: "global" | "project",
	): Promise<void> =>
		toggleToolAlwaysAllowExt(
			() => this.s,
			serverName,
			toolName,
			alwaysAllow,
			source,
			() => this.getMcpSettingsFilePath(),
			() => this.notifyWebview(),
		)

	toggleToolEnabledForPrompt = (
		serverName: string,
		toolName: string,
		enabled: boolean,
		source?: "global" | "project",
	): Promise<void> =>
		toggleToolEnabledForPromptExt(
			() => this.s,
			serverName,
			toolName,
			enabled,
			source,
			() => this.getMcpSettingsFilePath(),
			() => this.notifyWebview(),
		)

	handleMcpEnabledChange = (enabled: boolean): Promise<void> =>
		handleMcpEnabledChange(this.s, enabled, () => this.refreshAllConnections())

	async dispose(): Promise<void> {
		if (this.isDisposed) return
		this.isDisposed = true
		this.isProgrammaticUpdate = false

		await disposeHub(
			this.s,
			this.connections,
			this.settingsWatcher,
			this.projectMcpWatcher,
			this.disposables,
			this.configChangeDebounceTimers,
			this.flagResetTimer,
		)

		this.connections = []
		this.settingsWatcher = undefined
		this.projectMcpWatcher = undefined
	}
}
