import EventEmitter from "events"
import * as vscode from "vscode"
import type {
	ClineMessage,
	GlobalState,
	JabberwockSettings,
	TaskProviderEvents,
	TelemetryProperties,
	TelemetryPropertiesProvider,
	ProviderName,
} from "@jabberwock/types"
import { TelemetryService, getTelemetryService, hasTelemetryService } from "@jabberwock/telemetry"

import { Package } from "../../shared/package"
import { getWorkspacePath } from "../../utils/path"
import { McpServerManager, getMcpServerManager } from "../../services/mcp/McpServerManager"
import type { WindowManagerState } from "../../features/foundation/window-manager/store"
import type { ApiMessage } from "../task-persistence/apiMessages"
import type { IBackendRootStore } from "../../features/store"
import { getServiceRegistry } from "../../features/core/ServiceRegistry"
import type { Task } from "../../features/chat/task/Task"
import type { TaskState } from "../../features/chat/task/store"

// ─── State shape for getState() — used by tools/build-tools etc. ─────
import type { Instance } from "mobx-state-tree"

export interface GetStateResult {
	diagnosticsEnabled?: boolean
	writeDelayMs?: number
	experiments?: Record<string, boolean>
	maxWorkspaceFiles?: number
	maxOpenTabsContext?: number
	includeCurrentTime?: boolean
	includeCurrentCost?: boolean
	maxGitStatusFiles?: number
	showJabberwockIgnoredFiles?: boolean
	customModes?: unknown[]
	customModePrompts?: Record<
		string,
		{ description?: string; roleDefinition?: string; whenToUse?: string; customInstructions?: string }
	>
	customInstructions?: string
	language?: string
	apiConfiguration?: {
		rateLimitSeconds?: number
		maxOpenAiChatHistory?: number
		includeMaxTokens?: boolean
		maxTokens?: number
		requestyApiKey?: string
		requestyBaseUrl?: string
		unboundApiKey?: string
		lmStudioBaseUrl?: string
		ollamaBaseUrl?: string
		baseUrl?: string
		apiKey?: string
		apiProvider?: ProviderName
		todoListEnabled?: boolean
		[key: string]: unknown
	}
	terminalShellIntegrationDisabled?: boolean
	terminalOutputPreviewSize?: number
	mode?: string
	imageGenerationProvider?: unknown
	openRouterImageGenerationSelectedModel?: string
	openRouterImageApiKey?: string
	mcpEnabled?: boolean
	listApiConfigMeta?: unknown
	currentApiConfigName?: string
	tasks?: unknown[]
	disabledTools?: string[]
	customSupportPrompts?: Record<string, string | undefined>
	maxImageFileSize?: number
	maxTotalImageSize?: number
	// ── Commonly accessed from GetStateResult by consumer code ──
	hasOpenedModeSelector?: boolean
	systemPromptTemplates?: Record<string, string>
	enableSubfolderRules?: boolean
	includeDiagnosticMessages?: boolean
	maxDiagnosticMessages?: number
	autoApprovalEnabled?: boolean
	requestDelaySeconds?: number
	autoCondenseContext?: boolean
	autoCondenseContextPercent?: number
	profileThresholds?: Record<string, number>
	requestyBaseUrl?: string
	[key: string]: unknown
}

/**
 * Stub for Task instances retrieved from history.
 * HistoryTaskItem extends Record<string, unknown>, and at runtime
 * stored history items have Task-like methods. This shared Record base
 * allows the cast from HistoryTaskItem while providing type-safe access
 * to the methods callers actually use.
 */
export interface TaskStub extends Record<string, unknown> {
	resumeAfterDelegation?: (result?: string) => Promise<void>
	startSubtask?: (
		message: string,
		initialTodos: unknown[],
		mode: string,
	) => Promise<import("../../features/chat/task/Task").Task | undefined>
}

/**
 * Minimal interface for CurrentTask (Task-like object) that handlers use.
 * Defined here instead of importing Task to avoid circular dependencies.
 */
export interface CurrentTask {
	readonly cwd: string
	readonly taskId: string
	readonly parentTaskId?: string
	readonly clineMessages: ClineMessage[]
	readonly apiConversationHistory: ApiMessage[]
	readonly isInitialized: boolean
	abort: boolean
	readonly jabberwockIgnoreController?:
		| {
				validateAccess(filePath: string): boolean
				filterPaths(paths: string[]): string[]
				getInstructions(): string | undefined
		  }
		| undefined
	readonly messageManager: {
		rewindToTimestamp(ts: number, options?: { includeTargetMessage?: boolean }): Promise<void>
	}
	readonly messageQueueService: {
		addMessage(text: string, images?: string[]): void
		updateMessage(id: string, text: string, images?: string[]): void
		removeMessage(id: string): void
	}

	abortTask(): void
	checkpointDiff(options: {
		ts: number
		mode: "from-init" | "checkpoint" | "to-current" | "full"
		commitHash: string
		previousCommitHash?: string
	}): Promise<void>
	checkpointRestore(options: {
		ts: number
		mode: "preview" | "restore"
		commitHash: string
		operation?: "delete" | "edit"
	}): Promise<void>
	condenseContext(): Promise<void>
	handleTerminalOperation(operation: unknown): void
	handleWebviewAskResponse(type: string, text?: string, images?: string[]): void
	resolveElicitation(values: Record<string, unknown>): void
	submitUserMessage(text: string, images?: string[], mode?: string, providerProfile?: string): Promise<void>
	updateApiConfiguration(profile: unknown): void
	getTaskMode(): Promise<string>
	setTaskMode(mode: string): void
}

interface WorkspaceStore {
	setWorkspace(filePaths: string[], openedTabs: unknown): void
}

interface McpServersStore {
	setServers(servers: unknown[]): void
}

export class EventBridge
	extends EventEmitter<TaskProviderEvents>
	implements vscode.WebviewViewProvider, TelemetryPropertiesProvider
{
	readonly mdmService?: import("../../services/mdm/MdmService").MdmService
	static readonly sideBarId = `${Package.name}.SidebarProvider`
	private static activeInstances: Set<EventBridge> = new Set()
	private static _customModesManager: import("../../core/config/CustomModesManager").CustomModesManager | undefined
	private static _providerSettingsManager:
		| import("../../core/config/ProviderSettingsManager").ProviderSettingsManager
		| undefined
	private static _interceptor: import("../../integrations/terminal/OutputInterceptor").OutputInterceptor | undefined
	private static _outputChannel: vscode.OutputChannel | undefined

	static get outputChannel(): vscode.OutputChannel | undefined {
		return EventBridge._outputChannel
	}

	get contextProxy(): import("../../core/config/ContextProxy").ContextProxy {
		return this._contextProxy
	}

	get outputChannel(): vscode.OutputChannel {
		return this._outputChannel
	}

	get cwd(): string {
		return this._cwd
	}

	set cwd(value: string) {
		this._cwd = value
	}

	private _cwd: string = ""
	private _contextProxy: import("../../core/config/ContextProxy").ContextProxy
	chatStore: Instance<typeof import("../../core/state/ChatTreeStore").ChatStore> | undefined

	set customModesManager(value: import("../../core/config/CustomModesManager").CustomModesManager | undefined) {
		EventBridge._customModesManager = value
	}

	get customModesManager(): import("../../core/config/CustomModesManager").CustomModesManager | undefined {
		return EventBridge._customModesManager
	}

	set providerSettingsManager(
		value: import("../../core/config/ProviderSettingsManager").ProviderSettingsManager | undefined,
	) {
		EventBridge._providerSettingsManager = value
	}

	get providerSettingsManager():
		| import("../../core/config/ProviderSettingsManager").ProviderSettingsManager
		| undefined {
		return EventBridge._providerSettingsManager
	}

	set interceptor(value: import("../../integrations/terminal/OutputInterceptor").OutputInterceptor | undefined) {
		EventBridge._interceptor = value
	}

	get interceptor(): import("../../integrations/terminal/OutputInterceptor").OutputInterceptor | undefined {
		return EventBridge._interceptor
	}

	get latestAnnouncementId(): string {
		return this._latestAnnouncementId
	}

	set latestAnnouncementId(value: string) {
		this._latestAnnouncementId = value
	}

	private _latestAnnouncementId = ""

	get settingsImportedAt(): number {
		return this._settingsImportedAt
	}

	set settingsImportedAt(value: number) {
		this._settingsImportedAt = value
	}

	private _settingsImportedAt = 0

	get taskStack(): CurrentTask[] {
		return this._taskStack
	}

	private _taskStack: CurrentTask[] = []

	getCurrentTask(): CurrentTask | undefined {
		return this._currentTask ?? undefined
	}

	private _currentTask: CurrentTask | null = null

	constructor(
		readonly context: vscode.ExtensionContext,
		private readonly _outputChannel: vscode.OutputChannel,
		public readonly renderContext: "sidebar" | "editor" = "sidebar",
		contextProxy: import("../../core/config/ContextProxy").ContextProxy,
		mdmService?: import("../../services/mdm/MdmService").MdmService,
	) {
		super()
		EventBridge.activeInstances.add(this)
		this._contextProxy = contextProxy
		this.mdmService = mdmService

		getTelemetryService().setProvider(this)
	}

	/**
	 * Initialize all feature states asynchronously.
	 * MUST be called AFTER createBackendRootStore() to avoid circular
	 * dependency issues during esbuild __esm module initialization.
	 */
	async initFeatures(): Promise<void> {
		await Promise.all([
			import("../../features/foundation").then((m) => m.initFoundationState(this)),
			import("../../features/history").then((m) => m.initHistoryState(this, this._contextProxy)),
			import("../../features/chat").then((m) => m.initChatState(this)),
			import("../../features/settings").then((m) => m.initSettingsState(this)),
			import("../../features/cloud").then((m) => m.initCloudState(this)),
			import("../../features/telemetry").then((m) => m.initTelemetryState(this)),
			import("../../features/marketplace").then((m) => m.initMarketplaceState(this)),
			import("../../features/diagnostics").then((m) => m.initDiagnosticsState(this)),
		])
	}

	// ─── TelemetryPropertiesProvider interface ────────────
	async getTelemetryProperties(): Promise<TelemetryProperties> {
		const vscodeVersion = vscode.version
		const platform = process.platform
		const appVersion =
			((this.context.extension.packageJSON as Record<string, unknown>)?.version as string | undefined) ??
			Package.version ??
			"unknown"
		const editorName = vscode.env.appName
		const language = vscode.env.language
		const mode = await this.getMode()

		let hostname: string | undefined
		try {
			hostname = (await import("os")).hostname()
		} catch {
			// hostname not available
		}

		let cloudIsAuthenticated: boolean | undefined
		try {
			const { getCloudService } = await import("@jabberwock/cloud")
			cloudIsAuthenticated = getCloudService()?.isAuthenticated?.() ?? undefined
		} catch {
			// CloudService not available
		}

		return {
			appName: editorName,
			appVersion,
			vscodeVersion,
			platform,
			editorName,
			hostname,
			language,
			mode,
			cloudIsAuthenticated,
		}
	}

	// ─── WebviewViewProvider interface (MANDATORY — vscode API) ──────
	async resolveWebviewView(webviewView: vscode.WebviewView | vscode.WebviewPanel) {
		const { resolveWebviewView } = await import("../../features/foundation/window-manager/store")
		return resolveWebviewView(this, webviewView)
	}

	// ─── Public API (used externally across codebase) ────────────────
	async postMessageToWebview(message: Record<string, unknown>) {
		const { postMessageToWebview } = await import("../../features/foundation/window-manager/store")
		return postMessageToWebview(this, message)
	}

	// ─── McpHub accessor (tools need this via provider) ────────────
	getMcpHub() {
		return getMcpServerManager().getInstance(this.context, this)
	}

	// ─── Logging utility ────────────────────────────────────────────
	log(message: string): void {
		this._outputChannel.appendLine(`[EventBridge] ${message}`)
	}

	// ─── Static utility methods ─────────────────────────────────────
	static async getVisibleInstance(): Promise<EventBridge | undefined> {
		const { getWindowManagerState } = await import("../../features/foundation/window-manager/store")
		return Array.from(EventBridge.activeInstances).find((instance) => {
			try {
				const state = getWindowManagerState(instance)
				return state.view?.visible ?? false
			} catch {
				return false
			}
		})
	}

	static getFirstAvailableInstance(): EventBridge | undefined {
		return Array.from(EventBridge.activeInstances)[0]
	}

	// ─── State access (backward-compatible with pre-MST API) ────────
	async getState(): Promise<GetStateResult> {
		const { getBackendRootStore } = await import("../../features/storeSingleton")
		try {
			const store = getBackendRootStore()
			const { getSnapshot } = await import("mobx-state-tree")
			const snapshot = getSnapshot(store) as GetStateResult

			// MST getSnapshot returns a frozen object — spread into a mutable copy.
			const result: GetStateResult = { ...snapshot }

			// Lift apiConfig from MST store into the flat apiConfiguration field
			// that consumers like startTask.ts / buildApiHandler() expect.
			const apiConfig = store.settings.apiConfig
			if (apiConfig.apiProvider) {
				result.apiConfiguration = apiConfig.toProviderSettings() as GetStateResult["apiConfiguration"]
			}

			return result
		} catch (error) {
			console.error(`[EventBridge.getState] Failed to get snapshot:`, error)
			return {} as GetStateResult
		}
	}

	// ─── Lifecycle ──────────────────────────────────────────────────
	dispose(): void {
		void import("../../features/foundation/window-manager/store").then(({ getWindowManagerState }) => {
			try {
				const state = getWindowManagerState(this)
				if (state) {
					state.disposables.forEach((d: vscode.Disposable) => d.dispose())
				}
			} catch {
				// State may not be available during dispose
			}
		})
		EventBridge.activeInstances.delete(this)
	}

	// ─── Mode access ────────────────────────────────────────────────
	getMode(): Promise<string> {
		try {
			return Promise.resolve(this._contextProxy.getValue("mode") ?? "normal")
		} catch {
			return Promise.resolve("normal")
		}
	}

	// ─── DevTool bridge support ───────────────────────────────────────
	async findElement(selector: string, depth?: number, maxChildren?: number, command?: string): Promise<string> {
		// Using require() to match the existing setDomRequestCallback pattern
		const { getWindowManagerState } = require("../../features/foundation/window-manager/store")
		const state = getWindowManagerState(this)
		const requestId = Math.random().toString(36).substring(7)

		return new Promise<string>((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error(`Timeout waiting for DOM response (findElement, req: ${requestId})`))
			}, 10000)

			state.pendingDomRequests.set(requestId, {
				callback: (result: string) => {
					clearTimeout(timeout)
					resolve(result)
				},
				meta: { type: "dom-request", params: { selector, depth, maxChildren, command } },
			})

			this.postMessageToWebview({
				type: "action",
				action: command ?? "findElementById",
				requestId,
				selector,
				depth: depth ?? 0,
				maxChildren: maxChildren ?? 0,
			})
		})
	}

	async getModes(): Promise<{ slug: string; name: string }[]> {
		const { getAllModes } = await import("../../shared/modes")
		const customModes = EventBridge._customModesManager
			? await EventBridge._customModesManager.getCustomModes()
			: undefined
		return getAllModes(customModes).map((m) => ({ slug: m.slug, name: m.name }))
	}

	// ─── Callback registration (used by DevTool bridge) ─────────────
	setDomRequestCallback(requestId: string, callback: (result: string) => void): void {
		const { getWindowManagerState } = require("../../features/foundation/window-manager/store")
		const state = getWindowManagerState(this)
		state.pendingDomRequests.set(requestId, {
			callback,
			meta: {
				type: "dom-request-callback",
				params: { requestId },
				timestamp: Date.now(),
				status: "pending" as const,
			},
		})
	}

	setActivePageRequestCallback(requestId: string, callback: (result: string) => void): void {
		const { getWindowManagerState } = require("../../features/foundation/window-manager/store")
		const state = getWindowManagerState(this)
		// The MST model's pendingActivePageRequests map stores (activePage: string) => void callbacks
		state.pendingActivePageRequests.set(requestId, callback)
	}

	async getTaskWithId(id: string): Promise<TaskStub | null> {
		const { getTaskWithId: getTask } = await import("../../features/history/store")
		const { historyItem } = await getTask(this, id)
		return (historyItem as TaskStub | null) ?? null
	}

	// ─── Delegating methods (ContextProxy passthrough) ──────────────
	async setValue<K extends keyof JabberwockSettings>(key: K, value: JabberwockSettings[K]): Promise<void> {
		return this._contextProxy.setValue(key, value)
	}

	getValue<K extends keyof JabberwockSettings>(key: K): JabberwockSettings[K] {
		return this._contextProxy.getValue(key)
	}

	getValues(): JabberwockSettings {
		return this._contextProxy.getValues()
	}

	async updateGlobalState<K extends keyof GlobalState>(key: K, value: GlobalState[K]): Promise<void> {
		return this._contextProxy.updateGlobalState(key, value)
	}

	// ─── OAuth callback handlers (dynamically attached by extension activation) ──
	handleOpenRouterCallback?: (code: string) => Promise<void>
	handleRequestyCallback?: (code: string, baseUrl: string | null) => Promise<void>

	// ─── Tab panel identifier ──────────────────────────────────────
	static readonly tabPanelId = `${Package.name}.TabPanel`

	// ─── Dynamic store accessors (set by FoundationModel) ──────────
	mcpServersStore?: McpServersStore
	workspaceStore?: WorkspaceStore

	// ─── Task stack management ─────────────────────────────────────
	async addClineToStack(task: CurrentTask): Promise<void> {
		this._taskStack.push(task)
		this._currentTask = task
	}

	async removeClineFromStack(): Promise<void> {
		this._taskStack.pop()
		this._currentTask = this._taskStack.length > 0 ? this._taskStack[this._taskStack.length - 1] : null
	}
}
