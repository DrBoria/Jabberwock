import { types, onSnapshot, IStateTreeNode, Instance, getSnapshot } from "mobx-state-tree"
import * as vscode from "vscode"
import debounce from "lodash.debounce"

import {
	type ExtensionState,
	type CloudOrganizationMembership,
	type HistoryItem,
	DEFAULT_WRITE_DELAY_MS,
	DEFAULT_CHECKPOINT_TIMEOUT_SECONDS,
} from "@jabberwock/types"
import { CloudService, getJabberwockApiUrl } from "@jabberwock/cloud"

import { diagnosticsManager } from "@jabberwock/devtool"
import { Package } from "../../../../shared/package"
import { defaultModeSlug } from "../../../../shared/modes"
import { experimentDefault } from "../../../../shared/experiments"
import { formatLanguage } from "../../../../shared/language"
import { EMBEDDING_MODEL_PROFILES } from "../../../../shared/embeddingModels"

import type { ClineProvider } from "../../../webview/ClineProvider"

/**
 * Connection state for the MST bridge between extension and webview.
 */
/**
 * CommandExecutionStore — tracks command execution status for the webview.
 * Replaces the `commandExecutionStatus` postMessage with MST snapshot propagation.
 */
export const CommandExecutionStore = types
	.model("CommandExecutionStore", {
		executions: types.optional(types.array(types.frozen<any>()), []),
	})
	.actions((self) => ({
		addOrUpdateExecution(status: any) {
			const idx = self.executions.findIndex((e: any) => e.executionId === status.executionId)
			if (idx >= 0) {
				self.executions[idx] = status
			} else {
				self.executions.push(status)
			}
		},
		clearExecutions() {
			self.executions.clear()
		},
	}))

/**
 * McpExecutionStore — tracks MCP execution status for the webview.
 * Replaces the `mcpExecutionStatus` postMessage with MST snapshot propagation.
 */
export const McpExecutionStore = types
	.model("McpExecutionStore", {
		executions: types.optional(types.array(types.frozen<any>()), []),
	})
	.actions((self) => ({
		addOrUpdateExecution(status: any) {
			const idx = self.executions.findIndex((e: any) => e.executionId === status.executionId)
			if (idx >= 0) {
				self.executions[idx] = status
			} else {
				self.executions.push(status)
			}
		},
		clearExecutions() {
			self.executions.clear()
		},
	}))

/**
 * WorkspaceStore — tracks workspace state (file paths, opened tabs).
 * Replaces the `workspaceUpdated` postMessage with MST snapshot propagation.
 */
export const WorkspaceStore = types
	.model("WorkspaceStore", {
		filePaths: types.optional(types.array(types.string), []),
		openedTabs: types.optional(
			types.array(types.frozen<{ label: string; isActive: boolean; path?: string }>()),
			[],
		),
	})
	.actions((self) => ({
		setWorkspace(filePaths: string[], openedTabs: Array<{ label: string; isActive: boolean; path?: string }>) {
			self.filePaths.replace(filePaths)
			self.openedTabs.replace(openedTabs)
		},
	}))

export type IWorkspaceStore = Instance<typeof WorkspaceStore>

/**
 * CommandsStore — tracks available slash commands.
 * Replaces the `commands` postMessage with MST snapshot propagation.
 */
export const CommandsStore = types
	.model("CommandsStore", {
		commands: types.optional(types.array(types.frozen<any>()), []),
	})
	.actions((self) => ({
		setCommands(commands: any[]) {
			self.commands.replace(commands)
		},
	}))

export type ICommandsStore = Instance<typeof CommandsStore>

/**
 * McpServersStore — tracks MCP server list.
 * Replaces the `mcpServers` postMessage with MST snapshot propagation.
 */
export const McpServersStore = types
	.model("McpServersStore", {
		servers: types.optional(types.array(types.frozen<any>()), []),
	})
	.actions((self) => ({
		setServers(servers: any[]) {
			self.servers.replace(servers)
		},
	}))

export type IMcpServersStore = Instance<typeof McpServersStore>

/**
 * SkillsStore — tracks available skills.
 * Replaces the `skills` postMessage with MST snapshot propagation.
 */
export const SkillsStore = types
	.model("SkillsStore", {
		skills: types.optional(types.array(types.frozen<any>()), []),
	})
	.actions((self) => ({
		setSkills(skills: any[]) {
			self.skills.replace(skills)
		},
	}))

export type ISkillsStore = Instance<typeof SkillsStore>

/**
 * TaskHistoryStore — tracks task history updates.
 * Replaces the `taskHistoryUpdated` and `taskHistoryItemUpdated` postMessages
 * with MST snapshot propagation.
 */
export const TaskHistoryStoreMst = types
	.model("TaskHistoryStore", {
		items: types.optional(types.array(types.frozen<any>()), []),
	})
	.actions((self) => ({
		setItems(items: any[]) {
			self.items.replace(items)
		},
		upsertItem(item: any) {
			const idx = self.items.findIndex((h: any) => h.id === item.id)
			if (idx >= 0) {
				self.items[idx] = item
			} else {
				self.items.unshift(item)
			}
		},
	}))

export type ITaskHistoryStore = Instance<typeof TaskHistoryStoreMst>

/**
 * DiagnosticsStore — tracks diagnostics state.
 * Replaces the `diagnostics` postMessage with MST snapshot propagation.
 */
export const DiagnosticsStore = types
	.model("DiagnosticsStore", {
		diagnostics: types.maybe(types.frozen<any>()),
	})
	.actions((self) => ({
		setDiagnostics(diagnostics: any) {
			self.diagnostics = diagnostics
		},
	}))

export type IDiagnosticsStore = Instance<typeof DiagnosticsStore>

/**
 * MarketplaceStore — tracks marketplace data.
 * Replaces the `marketplaceData` postMessage with MST snapshot propagation.
 */
export const MarketplaceStore = types
	.model("MarketplaceStore", {
		marketplaceItems: types.optional(types.array(types.frozen<any>()), []),
		marketplaceInstalledMetadata: types.maybe(types.frozen<any>()),
	})
	.actions((self) => ({
		setMarketplaceData(items: any[], installedMetadata?: any) {
			self.marketplaceItems.replace(items)
			if (installedMetadata !== undefined) {
				self.marketplaceInstalledMetadata = installedMetadata
			}
		},
	}))

export type IMarketplaceStore = Instance<typeof MarketplaceStore>

/**
 * CheckpointStore — tracks checkpoint state.
 * Replaces the `currentCheckpointUpdated` postMessage with MST snapshot propagation.
 */
export const CheckpointStore = types
	.model("CheckpointStore", {
		currentCheckpoint: types.maybe(types.string),
	})
	.actions((self) => ({
		setCurrentCheckpoint(checkpoint?: string) {
			self.currentCheckpoint = checkpoint
		},
	}))

export type ICheckpointStore = Instance<typeof CheckpointStore>

/**
 * RouterModelsStore — tracks router model lists.
 * Replaces the `routerModels`, `ollamaModels`, `lmStudioModels`, `openAiModels`,
 * `vsCodeLmModels`, `singleRouterModelFetchResponse` postMessages with MST snapshot propagation.
 */
export const RouterModelsStore = types
	.model("RouterModelsStore", {
		routerModels: types.maybe(types.frozen<any>()),
		ollamaModels: types.maybe(types.frozen<any>()),
		lmStudioModels: types.maybe(types.frozen<any>()),
		openAiModels: types.maybe(types.frozen<any>()),
		vsCodeLmModels: types.maybe(types.frozen<any>()),
	})
	.actions((self) => ({
		setRouterModels(models: any) {
			self.routerModels = models
		},
		setOllamaModels(models: any) {
			self.ollamaModels = models
		},
		setLmStudioModels(models: any) {
			self.lmStudioModels = models
		},
		setOpenAiModels(models: any) {
			self.openAiModels = models
		},
		setVsCodeLmModels(models: any) {
			self.vsCodeLmModels = models
		},
	}))

export type IRouterModelsStore = Instance<typeof RouterModelsStore>

/**
 * ListApiConfigStore — tracks API configuration list.
 * Replaces the `listApiConfig` postMessage with MST snapshot propagation.
 */
export const ListApiConfigStore = types
	.model("ListApiConfigStore", {
		listApiConfig: types.optional(types.array(types.frozen<any>()), []),
	})
	.actions((self) => ({
		setListApiConfig(configs: any[]) {
			self.listApiConfig.replace(configs)
		},
	}))

export type IListApiConfigStore = Instance<typeof ListApiConfigStore>

export type IMcpExecutionStore = Instance<typeof McpExecutionStore>

export type ICommandExecutionStore = Instance<typeof CommandExecutionStore>

export const MstBridgeStore = types
	.model("MstBridgeStore", {
		connectionState: types.optional(
			types.enumeration(["connected", "disconnected", "reconnecting"]),
			"disconnected",
		),
		lastSyncAt: types.maybe(types.number),
		pendingBatchSize: types.optional(types.number, 0),
	})
	.actions((self) => ({
		/**
		 * Mark the bridge as connected.
		 */
		setConnected() {
			self.connectionState = "connected"
			self.lastSyncAt = Date.now()
		},

		/**
		 * Mark the bridge as disconnected.
		 */
		setDisconnected() {
			self.connectionState = "disconnected"
		},

		/**
		 * Mark the bridge as reconnecting.
		 */
		setReconnecting() {
			self.connectionState = "reconnecting"
		},

		/**
		 * Update the pending batch size counter.
		 */
		setPendingBatchSize(size: number) {
			self.pendingBatchSize = size
		},
	}))

/**
 * Creates an MstBridgeStore instance and sets up snapshot subscriptions.
 * @param stores - An array of MST store instances to subscribe to.
 * @param sendMessage - A function that sends typed messages to the webview.
 * @param batchIntervalMs - How often to flush batched snapshots (default: 50ms).
 */
export function createMstBridgeStore(
	stores: IStateTreeNode[],
	sendMessage: (message: { type: string; payload: any }) => void,
	batchIntervalMs = 50,
) {
	const bridge = MstBridgeStore.create({})

	// Batched snapshot queue
	let snapshotQueue: Array<{ storeName: string; snapshot: any }> = []
	let flushTimer: ReturnType<typeof setTimeout> | null = null

	const flush = () => {
		if (snapshotQueue.length === 0) return

		const batch = snapshotQueue.slice()
		snapshotQueue = []

		bridge.setPendingBatchSize(batch.length)
		sendMessage({
			type: "mst-snapshot-batch",
			payload: { snapshots: batch },
		})
		bridge.setPendingBatchSize(0)

		flushTimer = null
	}

	const enqueueSnapshot = (storeName: string, snapshot: any) => {
		snapshotQueue.push({ storeName, snapshot })

		if (!flushTimer) {
			flushTimer = setTimeout(flush, batchIntervalMs)
		}
	}

	// Subscribe to each store
	for (const store of stores) {
		onSnapshot(store, (snapshot) => {
			const storeName = (store as any).$modelType ?? "unknown"
			enqueueSnapshot(storeName, snapshot)
		})
	}

	bridge.setConnected()

	return bridge
}

export type IMstBridgeStore = Instance<typeof MstBridgeStore>

// ---------------------------------------------------------------------------
// State posting helpers (extracted from ClineProvider)
// ---------------------------------------------------------------------------

/**
 * Assembles the full ExtensionState object to send to the webview.
 */
export async function getStateToPostToWebview(provider: ClineProvider): Promise<ExtensionState> {
	const p = provider as any

	// Ensure the store is initialized before reading task history
	await p.taskHistoryStore.initialized

	const {
		apiConfiguration,
		lastShownAnnouncementId,
		customInstructions,
		alwaysAllowReadOnly,
		alwaysAllowReadOnlyOutsideWorkspace,
		alwaysAllowWrite,
		alwaysAllowWriteOutsideWorkspace,
		alwaysAllowWriteProtected,
		alwaysAllowExecute,
		allowedCommands,
		deniedCommands,
		alwaysAllowMcp,
		alwaysAllowModeSwitch,
		alwaysAllowSubtasks,
		allowedMaxRequests,
		allowedMaxCost,
		autoCondenseContext,
		autoCondenseContextPercent,
		soundEnabled,
		ttsEnabled,
		ttsSpeed,
		enableCheckpoints,
		checkpointTimeout,
		taskHistory,
		soundVolume,
		writeDelayMs,
		terminalShellIntegrationTimeout,
		terminalShellIntegrationDisabled,
		terminalCommandDelay,
		terminalPowershellCounter,
		terminalZshClearEolMark,
		terminalZshOhMy,
		terminalZshP10k,
		terminalZdotdir,
		mcpEnabled,
		currentApiConfigName,
		listApiConfigMeta,
		pinnedApiConfigs,
		mode,
		customModePrompts,
		customSupportPrompts,
		enhancementApiConfigId,
		autoApprovalEnabled,
		customModes,
		experiments,
		maxOpenTabsContext,
		maxWorkspaceFiles,
		disabledTools,
		telemetrySetting,
		showJabberwockIgnoredFiles,
		enableSubfolderRules,
		language,
		maxImageFileSize,
		maxTotalImageSize,
		historyPreviewCollapsed,
		reasoningBlockCollapsed,
		enterBehavior,
		cloudUserInfo,
		cloudIsAuthenticated,
		sharingEnabled,
		publicSharingEnabled,
		organizationAllowList,
		organizationSettingsVersion,
		customCondensingPrompt,
		codebaseIndexConfig,
		codebaseIndexModels,
		profileThresholds,
		alwaysAllowFollowupQuestions,
		followupAutoApproveTimeoutMs,
		includeDiagnosticMessages,
		maxDiagnosticMessages,
		includeTaskHistoryInEnhance,
		includeCurrentTime,
		includeCurrentCost,
		maxGitStatusFiles,
		taskSyncEnabled,
		imageGenerationProvider,
		openRouterImageApiKey,
		openRouterImageGenerationSelectedModel,
		lockApiConfigAcrossModes,
		locatorTarget,
	} = await p.getState()

	let cloudOrganizations: CloudOrganizationMembership[] = []

	if (CloudService.hasInstance()) {
		try {
			if (!CloudService.instance.isCloudAgent) {
				const now = Date.now()

				if (
					(p as any).cloudOrganizationsCache !== null &&
					(p as any).cloudOrganizationsCacheTimestamp !== null &&
					now - (p as any).cloudOrganizationsCacheTimestamp < 5000 // CLOUD_ORGANIZATIONS_CACHE_DURATION_MS
				) {
					cloudOrganizations = (p as any).cloudOrganizationsCache!
				} else {
					cloudOrganizations = await CloudService.instance.getOrganizationMemberships()
					;(p as any).cloudOrganizationsCache = cloudOrganizations
					;(p as any).cloudOrganizationsCacheTimestamp = now
				}
			}
		} catch (error) {
			// Ignore this error.
		}
	}

	const telemetryKey = process.env.POSTHOG_API_KEY
	const machineId = vscode.env.machineId
	const mergedAllowedCommands = (p as any).mergeAllowedCommands(allowedCommands)
	const mergedDeniedCommands = (p as any).mergeDeniedCommands(deniedCommands)
	const cwd = p.cwd
	const currentTask = p.getCurrentTask()

	return {
		version: p.context.extension?.packageJSON?.version ?? "",
		apiConfiguration,
		customInstructions,
		alwaysAllowReadOnly: alwaysAllowReadOnly ?? false,
		alwaysAllowReadOnlyOutsideWorkspace: alwaysAllowReadOnlyOutsideWorkspace ?? false,
		alwaysAllowWrite: alwaysAllowWrite ?? false,
		alwaysAllowWriteOutsideWorkspace: alwaysAllowWriteOutsideWorkspace ?? false,
		alwaysAllowWriteProtected: alwaysAllowWriteProtected ?? false,
		alwaysAllowExecute: alwaysAllowExecute ?? false,
		alwaysAllowMcp: alwaysAllowMcp ?? false,
		alwaysAllowModeSwitch: alwaysAllowModeSwitch ?? false,
		alwaysAllowSubtasks: alwaysAllowSubtasks ?? false,
		allowedMaxRequests,
		allowedMaxCost,
		autoCondenseContext: autoCondenseContext ?? true,
		autoCondenseContextPercent: autoCondenseContextPercent ?? 100,
		uriScheme: vscode.env.uriScheme,
		currentTaskId: currentTask?.taskId,
		currentTaskItem: currentTask?.taskId ? p.taskHistoryStore.get(currentTask.taskId) : undefined,
		clineMessages: currentTask?.clineMessages || [],
		currentTaskTodos: currentTask?.todoList || [],
		messageQueue: currentTask?.messageQueueService?.messages,
		taskHistory: p.taskHistoryStore.getAll().filter((item: HistoryItem) => item.ts && item.task),
		soundEnabled: soundEnabled ?? false,
		ttsEnabled: ttsEnabled ?? false,
		ttsSpeed: ttsSpeed ?? 1.0,
		enableCheckpoints: enableCheckpoints ?? true,
		checkpointTimeout: checkpointTimeout ?? DEFAULT_CHECKPOINT_TIMEOUT_SECONDS,
		shouldShowAnnouncement: telemetrySetting !== "unset" && lastShownAnnouncementId !== p.latestAnnouncementId,
		allowedCommands: mergedAllowedCommands,
		deniedCommands: mergedDeniedCommands,
		soundVolume: soundVolume ?? 0.5,
		writeDelayMs: writeDelayMs ?? DEFAULT_WRITE_DELAY_MS,
		terminalShellIntegrationTimeout: terminalShellIntegrationTimeout ?? 10000,
		terminalShellIntegrationDisabled: terminalShellIntegrationDisabled ?? true,
		devtoolEnabled: (p as any).devtoolEnabled,
		terminalCommandDelay: terminalCommandDelay ?? 0,
		terminalPowershellCounter: terminalPowershellCounter ?? false,
		terminalZshClearEolMark: terminalZshClearEolMark ?? true,
		terminalZshOhMy: terminalZshOhMy ?? false,
		terminalZshP10k: terminalZshP10k ?? false,
		terminalZdotdir: terminalZdotdir ?? false,
		mcpEnabled: mcpEnabled ?? true,
		currentApiConfigName: currentApiConfigName ?? "default",
		listApiConfigMeta: listApiConfigMeta ?? [],
		pinnedApiConfigs: pinnedApiConfigs ?? {},
		mode: mode ?? defaultModeSlug,
		customModePrompts: customModePrompts ?? {},
		customSupportPrompts: customSupportPrompts ?? {},
		enhancementApiConfigId,
		autoApprovalEnabled: autoApprovalEnabled ?? false,
		customModes,
		experiments: experiments ?? experimentDefault,
		mcpServers: p.mcpHub?.getAllServers() ?? [],
		maxOpenTabsContext: maxOpenTabsContext ?? 20,
		maxWorkspaceFiles: maxWorkspaceFiles ?? 200,
		cwd,
		disabledTools,
		telemetrySetting,
		telemetryKey,
		machineId,
		showJabberwockIgnoredFiles: showJabberwockIgnoredFiles ?? false,
		enableSubfolderRules: enableSubfolderRules ?? false,
		language: language ?? formatLanguage(vscode.env.language),
		renderContext: p.renderContext,
		maxImageFileSize: maxImageFileSize ?? 5,
		maxTotalImageSize: maxTotalImageSize ?? 20,
		settingsImportedAt: p.settingsImportedAt,
		historyPreviewCollapsed: historyPreviewCollapsed ?? false,
		reasoningBlockCollapsed: reasoningBlockCollapsed ?? true,
		enterBehavior: enterBehavior ?? "send",
		cloudUserInfo,
		cloudIsAuthenticated: cloudIsAuthenticated ?? false,
		cloudAuthSkipModel:
			((p as any).context.globalState.get as (key: string) => boolean | undefined)(
				"jabberwock-auth-skip-model",
			) ?? false,
		cloudOrganizations,
		sharingEnabled: sharingEnabled ?? false,
		publicSharingEnabled: publicSharingEnabled ?? false,
		organizationAllowList,
		organizationSettingsVersion,
		customCondensingPrompt,
		codebaseIndexModels: codebaseIndexModels ?? EMBEDDING_MODEL_PROFILES,
		codebaseIndexConfig: {
			codebaseIndexEnabled: codebaseIndexConfig?.codebaseIndexEnabled ?? false,
			codebaseIndexQdrantUrl: codebaseIndexConfig?.codebaseIndexQdrantUrl ?? "http://localhost:6333",
			codebaseIndexEmbedderProvider: codebaseIndexConfig?.codebaseIndexEmbedderProvider ?? "openai",
			codebaseIndexEmbedderBaseUrl: codebaseIndexConfig?.codebaseIndexEmbedderBaseUrl ?? "",
			codebaseIndexEmbedderModelId: codebaseIndexConfig?.codebaseIndexEmbedderModelId ?? "",
			codebaseIndexEmbedderModelDimension: codebaseIndexConfig?.codebaseIndexEmbedderModelDimension ?? 1536,
			codebaseIndexOpenAiCompatibleBaseUrl: codebaseIndexConfig?.codebaseIndexOpenAiCompatibleBaseUrl,
			codebaseIndexSearchMaxResults: codebaseIndexConfig?.codebaseIndexSearchMaxResults,
			codebaseIndexSearchMinScore: codebaseIndexConfig?.codebaseIndexSearchMinScore,
			codebaseIndexBedrockRegion: codebaseIndexConfig?.codebaseIndexBedrockRegion,
			codebaseIndexBedrockProfile: codebaseIndexConfig?.codebaseIndexBedrockProfile,
			codebaseIndexOpenRouterSpecificProvider: codebaseIndexConfig?.codebaseIndexOpenRouterSpecificProvider,
		},
		// Only set mdmCompliant if there's an actual MDM policy
		// undefined means no MDM policy, true means compliant, false means non-compliant
		mdmCompliant: (p as any).mdmService?.requiresCloudAuth() ? p.checkMdmCompliance() : undefined,
		profileThresholds: profileThresholds ?? {},
		cloudApiUrl: getJabberwockApiUrl(),
		hasOpenedModeSelector: (p as any).getGlobalState("hasOpenedModeSelector") ?? false,
		lockApiConfigAcrossModes: lockApiConfigAcrossModes ?? false,
		alwaysAllowFollowupQuestions: alwaysAllowFollowupQuestions ?? false,
		followupAutoApproveTimeoutMs: followupAutoApproveTimeoutMs ?? 60000,
		includeDiagnosticMessages: includeDiagnosticMessages ?? true,
		maxDiagnosticMessages: maxDiagnosticMessages ?? 50,
		includeTaskHistoryInEnhance: includeTaskHistoryInEnhance ?? true,
		includeCurrentTime: includeCurrentTime ?? true,
		includeCurrentCost: includeCurrentCost ?? true,
		maxGitStatusFiles: maxGitStatusFiles ?? 0,
		taskSyncEnabled,
		imageGenerationProvider,
		openRouterImageApiKey,
		openRouterImageGenerationSelectedModel,
		locatorTarget,
		openAiCodexIsAuthenticated: await (async () => {
			try {
				const { openAiCodexOAuthManager } = await import("../../../../integrations/openai-codex/oauth")
				return await openAiCodexOAuthManager.isAuthenticated()
			} catch {
				return false
			}
		})(),
		debug: vscode.workspace.getConfiguration(Package.name).get<boolean>("debug", false),
		diagnostics: diagnosticsManager.getSnapshot(),
	}
}

/**
 * Posts the full state to the webview, including chat tree snapshot.
 * Also checks MDM compliance and redirects to account tab if needed.
 */
export async function postStateToWebview(provider: ClineProvider): Promise<void> {
	const p = provider as any
	const state = await getStateToPostToWebview(provider)
	p.clineMessagesSeq++
	state.clineMessagesSeq = p.clineMessagesSeq
	p.postMessageToWebview({ type: "state", state })

	p.postMessageToWebview({
		type: "chatTreeSnapshot",
		snapshot: getSnapshot(p.chatStore),
	})

	// Check MDM compliance and send user to account tab if not compliant
	// Only redirect if there's an actual MDM policy requiring authentication
	if (p.mdmService?.requiresCloudAuth() && !p.checkMdmCompliance()) {
		await p.postMessageToWebview({ type: "action", action: "cloudButtonClicked" })
	}
}

/**
 * Posts state to webview with diagnostics.
 */
export async function postDiagnosticsToWebview(provider: ClineProvider): Promise<void> {
	const p = provider as any
	p.postMessageToWebview({
		type: "state",
		state: await getStateToPostToWebview(provider),
	})
}

/**
 * Debounced posting of chat tree snapshot to webview.
 */
export const postChatTreeToWebviewThrottled = debounce((provider: ClineProvider) => {
	const p = provider as any
	p.postMessageToWebview({
		type: "chatTreeSnapshot",
		snapshot: getSnapshot(p.chatStore),
	})
}, 1000)

/**
 * Like postStateToWebview but intentionally omits taskHistory.
 *
 * Rationale:
 * - taskHistory can be large and was being resent on every chat message update.
 * - The webview maintains taskHistory in-memory and receives updates via
 *   `taskHistoryUpdated` / `taskHistoryItemUpdated`.
 */
export async function postStateToWebviewWithoutTaskHistory(provider: ClineProvider): Promise<void> {
	const p = provider as any
	const state = await getStateToPostToWebview(provider)
	p.clineMessagesSeq++
	state.clineMessagesSeq = p.clineMessagesSeq
	const { taskHistory: _omit, ...rest } = state
	p.postMessageToWebview({ type: "state", state: rest })

	// Preserve existing MDM redirect behavior
	if (p.mdmService?.requiresCloudAuth() && !p.checkMdmCompliance()) {
		await p.postMessageToWebview({ type: "action", action: "cloudButtonClicked" })
	}
}

/**
 * Like postStateToWebview but intentionally omits both clineMessages and taskHistory.
 *
 * Rationale:
 * - Cloud event handlers (auth, settings, user-info) and mode changes trigger state pushes
 *   that have nothing to do with chat messages. Including clineMessages in these pushes
 *   creates race conditions where a stale snapshot of clineMessages (captured during async
 *   getStateToPostToWebview) overwrites newer messages the task has streamed in the meantime.
 * - This method ensures cloud/mode events only push the state fields they actually affect
 *   (cloud auth, org settings, profiles, etc.) without interfering with task message streaming.
 */
export async function postStateToWebviewWithoutClineMessages(provider: ClineProvider): Promise<void> {
	const p = provider as any
	const state = await getStateToPostToWebview(provider)
	const { clineMessages: _omitMessages, taskHistory: _omitHistory, ...rest } = state
	p.postMessageToWebview({ type: "state", state: rest })

	// Preserve existing MDM redirect behavior
	if (p.mdmService?.requiresCloudAuth() && !p.checkMdmCompliance()) {
		await p.postMessageToWebview({ type: "action", action: "cloudButtonClicked" })
	}
}
