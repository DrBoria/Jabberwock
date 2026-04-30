import * as path from "path"
import fs from "fs/promises"
import os from "os"

import { Anthropic } from "@anthropic-ai/sdk"

import * as vscode from "vscode"

import {
	type HistoryItem,
	type ExtensionState,
	type ProviderName,
	type CloudUserInfo,
	type MarketplaceInstalledMetadata,
	JabberwockEventName,
	ORGANIZATION_ALLOW_ALL,
	DEFAULT_CHECKPOINT_TIMEOUT_SECONDS,
	DEFAULT_WRITE_DELAY_MS,
	isRetiredProvider,
} from "@jabberwock/types"
import { CloudService } from "@jabberwock/cloud"
import { aggregateTaskCostsRecursive, type AggregatedCosts } from "../../../webview/aggregateTaskCosts"

import { Package } from "../../../../shared/package"
import { GlobalFileNames } from "../../../../shared/globalFileNames"
import { defaultModeSlug } from "../../../../shared/modes"
import { experimentDefault } from "../../../../shared/experiments"
import { formatLanguage } from "../../../../shared/language"
import { EMBEDDING_MODEL_PROFILES } from "../../../../shared/embeddingModels"

import { downloadTask, getTaskFileName } from "../../../../integrations/misc/export-markdown"
import { resolveDefaultSaveUri, saveLastExportPath } from "../../../../utils/export"
import { getWorkspacePath } from "../../../../utils/path"
import { fileExistsAtPath } from "../../../../utils/fs"
import { Terminal } from "../../../../integrations/terminal/Terminal"
import { ShadowCheckpointService } from "../../../../services/checkpoints/ShadowCheckpointService"

import type { ClineProvider } from "../../../webview/ClineProvider"
import type { ClineMessage, TodoItem } from "@jabberwock/types"
import type { Mode } from "../../../../shared/modes"

// ---------------------------------------------------------------------------
// Task History Management (extracted from ClineProvider)
// ---------------------------------------------------------------------------

export async function getTaskWithId(
	provider: ClineProvider,
	id: string,
): Promise<{
	historyItem: HistoryItem
	taskDirPath: string
	apiConversationHistoryFilePath: string
	uiMessagesFilePath: string
	apiConversationHistory: Anthropic.MessageParam[]
}> {
	const p = provider as any
	const historyItem =
		p.taskHistoryStore.get(id) ?? (p.getGlobalState("taskHistory") ?? []).find((item: any) => item.id === id)

	if (!historyItem) {
		throw new Error("Task not found")
	}

	const { getTaskDirectoryPath } = await import("../../../../utils/storage")
	const globalStoragePath = p.contextProxy.globalStorageUri.fsPath
	const taskDirPath = await getTaskDirectoryPath(globalStoragePath, id)
	const apiConversationHistoryFilePath = path.join(taskDirPath, GlobalFileNames.apiConversationHistory)
	const uiMessagesFilePath = path.join(taskDirPath, GlobalFileNames.uiMessages)
	const fileExists = await fileExistsAtPath(apiConversationHistoryFilePath)

	let apiConversationHistory: Anthropic.MessageParam[] = []

	if (fileExists) {
		try {
			apiConversationHistory = JSON.parse(await fs.readFile(apiConversationHistoryFilePath, "utf8"))
		} catch (error) {
			console.warn(
				`[getTaskWithId] api_conversation_history.json corrupted for task ${id}, returning empty history: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	} else {
		console.warn(`[getTaskWithId] api_conversation_history.json missing for task ${id}, returning empty history`)
	}

	return {
		historyItem,
		taskDirPath,
		apiConversationHistoryFilePath,
		uiMessagesFilePath,
		apiConversationHistory,
	}
}

export async function getTaskWithAggregatedCosts(
	provider: ClineProvider,
	taskId: string,
): Promise<{
	historyItem: HistoryItem
	aggregatedCosts: AggregatedCosts
}> {
	const { historyItem } = await getTaskWithId(provider, taskId)

	const aggregatedCosts = await aggregateTaskCostsRecursive(taskId, async (id: string) => {
		const result = await getTaskWithId(provider, id)
		return result.historyItem
	})

	return { historyItem, aggregatedCosts }
}

export async function showTaskWithId(provider: ClineProvider, id: string) {
	const p = provider as any
	if (id !== p.getCurrentTask()?.taskId) {
		// Non-current task.
		const { historyItem } = await getTaskWithId(provider, id)
		await p.createTaskWithHistoryItem(historyItem) // Clears existing task.
	}

	await p.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
}

export async function exportTaskWithId(provider: ClineProvider, id: string) {
	const p = provider as any
	const { historyItem, apiConversationHistory } = await getTaskWithId(provider, id)
	const fileName = getTaskFileName(historyItem.ts)
	const defaultUri = await resolveDefaultSaveUri(p.contextProxy, "lastTaskExportPath", fileName, {
		useWorkspace: false,
		fallbackDir: path.join(os.homedir(), "Downloads"),
	})
	const saveUri = await downloadTask(historyItem.ts, apiConversationHistory, defaultUri)

	if (saveUri) {
		await saveLastExportPath(p.contextProxy, "lastTaskExportPath", saveUri)
	}
}

export async function condenseTaskContext(provider: ClineProvider, taskId: string) {
	const p = provider as any
	let task: any | undefined
	for (let i = p.clineStack.length - 1; i >= 0; i--) {
		if (p.clineStack[i].taskId === taskId) {
			task = p.clineStack[i]
			break
		}
	}
	if (!task) {
		throw new Error(`Task with id ${taskId} not found in stack`)
	}
	await task.condenseContext()
	await p.postMessageToWebview({ type: "condenseTaskContextResponse", text: taskId })
}

export async function deleteTaskWithId(provider: ClineProvider, id: string, cascadeSubtasks: boolean = true) {
	const p = provider as any
	try {
		// get the task directory full path and history item
		const { taskDirPath, historyItem } = await getTaskWithId(provider, id)

		// Collect all task IDs to delete (parent + all subtasks)
		const allIdsToDelete: string[] = [id]

		if (cascadeSubtasks) {
			// Recursively collect all child IDs
			const collectChildIds = async (taskId: string): Promise<void> => {
				try {
					const { historyItem: item } = await getTaskWithId(provider, taskId)
					if (item.childIds && item.childIds.length > 0) {
						for (const childId of item.childIds) {
							allIdsToDelete.push(childId)
							await collectChildIds(childId)
						}
					}
				} catch (error) {
					// Child task may already be deleted or not found, continue
					console.log(`[deleteTaskWithId] child task ${taskId} not found, skipping`)
				}
			}

			await collectChildIds(id)
		}

		// Remove from stack if any of the tasks to delete are in the current task stack
		for (const taskId of allIdsToDelete) {
			if (taskId === p.getCurrentTask()?.taskId) {
				// Close the current task instance; delegation flows will be handled via metadata if applicable.
				await p.removeClineFromStack()
				break
			}
		}

		// Delete all tasks from state in one batch
		await p.taskHistoryStore.deleteMany(allIdsToDelete)
		p.recentTasksCache = undefined

		// Delete associated shadow repositories or branches and task directories
		const globalStorageDir = p.contextProxy.globalStorageUri.fsPath
		const workspaceDir = p.cwd
		const { getTaskDirectoryPath } = await import("../../../../utils/storage")
		const globalStoragePath = p.contextProxy.globalStorageUri.fsPath

		for (const taskId of allIdsToDelete) {
			try {
				await ShadowCheckpointService.deleteTask({ taskId, globalStorageDir, workspaceDir })
			} catch (error) {
				console.error(
					`[deleteTaskWithId${taskId}] failed to delete associated shadow repository or branch: ${error instanceof Error ? error.message : String(error)}`,
				)
			}

			// Delete the task directory
			try {
				const dirPath = await getTaskDirectoryPath(globalStoragePath, taskId)
				await fs.rm(dirPath, { recursive: true, force: true })
				console.log(`[deleteTaskWithId${taskId}] removed task directory`)
			} catch (error) {
				console.error(
					`[deleteTaskWithId${taskId}] failed to remove task directory: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		}

		await p.postStateToWebview()
	} catch (error) {
		// If task is not found, just remove it from state
		if (error instanceof Error && error.message === "Task not found") {
			await deleteTaskFromState(provider, id)
			return
		}
		throw error
	}
}

export async function deleteTaskFromState(provider: ClineProvider, id: string) {
	const p = provider as any
	await p.taskHistoryStore.delete(id)
	p.recentTasksCache = undefined

	await p.postStateToWebview()
}

export async function refreshWorkspace(provider: ClineProvider) {
	const p = provider as any
	p.currentWorkspacePath = getWorkspacePath()
	await p.postStateToWebview()
}

/**
 * Updates a task in the task history and optionally broadcasts the updated history to the webview.
 * Now delegates to TaskHistoryStore for per-task file persistence.
 */
export async function updateTaskHistory(
	provider: ClineProvider,
	item: HistoryItem,
	options: { broadcast?: boolean } = {},
): Promise<HistoryItem[]> {
	const p = provider as any
	const { broadcast = true } = options

	const history = await p.taskHistoryStore.upsert(item)
	p.recentTasksCache = undefined

	// Broadcast the updated history to the webview if requested.
	if (broadcast && p.isViewLaunched) {
		const updatedItem = p.taskHistoryStore.get(item.id) ?? item
		await p.postMessageToWebview({ type: "taskHistoryItemUpdated", taskHistoryItem: updatedItem })
		p.taskHistoryStoreMst?.upsertItem(updatedItem)
	}

	return history
}

/**
 * Broadcasts a task history update to the webview.
 */
export async function broadcastTaskHistoryUpdate(provider: ClineProvider, history?: HistoryItem[]) {
	const p = provider as any
	if (!p.isViewLaunched) {
		return
	}

	const taskHistory = history ?? p.taskHistoryStore.getAll()

	// Sort and filter the history the same way as getStateToPostToWebview
	const sortedHistory = taskHistory
		.filter((item: HistoryItem) => item.ts && item.task)
		.sort((a: HistoryItem, b: HistoryItem) => b.ts - a.ts)

	await p.postMessageToWebview({
		type: "taskHistoryUpdated",
		taskHistory: sortedHistory,
	})
	p.taskHistoryStoreMst?.setHistory(sortedHistory)
}

export async function resetState(provider: ClineProvider) {
	const p = provider as any
	const { t } = await import("../../../../i18n")

	const answer = await vscode.window.showInformationMessage(
		t("common:confirmation.reset_state"),
		{ modal: true },
		t("common:answers.yes"),
	)

	if (answer !== t("common:answers.yes")) {
		return
	}

	// Log out from cloud if authenticated
	if (CloudService.hasInstance()) {
		try {
			await CloudService.instance.logout()
		} catch (error) {
			p.log(`Failed to logout from cloud during reset: ${error instanceof Error ? error.message : String(error)}`)
			// Continue with reset even if logout fails
		}
	}

	await p.contextProxy.resetAllState()
	await p.providerSettingsManager.resetAllConfigs()
	await p.customModesManager.resetCustomModes()
	await p.removeClineFromStack()
	await p.postStateToWebview()
	await p.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
}

export function log(provider: ClineProvider, message: string) {
	const p = provider as any
	p.outputChannel.appendLine(message)
	console.log(message)
	// diagnosticsManager is accessed via dynamic import to avoid circular dependencies
	// during early extension initialization
	import("../../../devtools/DiagnosticsManager")
		.then(({ diagnosticsManager }) => {
			diagnosticsManager.log(message, message.toLowerCase().includes("error") ? "error" : "info")
		})
		.catch(() => {
			// diagnosticsManager may not be available during early initialization
		})
}

export function checkMdmCompliance(provider: ClineProvider): boolean {
	const p = provider as any
	if (!p.mdmService) {
		return true
	}

	const compliance = p.mdmService.isCompliant()

	if (!compliance.compliant) {
		return false
	}

	return true
}

export function getCurrentTask(provider: ClineProvider): any | undefined {
	const p = provider as any
	if (p.clineStack.length === 0) {
		return undefined
	}

	return p.clineStack[p.clineStack.length - 1]
}

export function getRecentTasks(provider: ClineProvider): string[] {
	const p = provider as any
	if (p.recentTasksCache) {
		return p.recentTasksCache
	}

	const history = p.taskHistoryStore.getAll()
	const workspaceTasks: HistoryItem[] = []

	for (const item of history) {
		if (!item.ts || !item.task || item.workspace !== p.cwd) {
			continue
		}

		workspaceTasks.push(item)
	}

	if (workspaceTasks.length === 0) {
		p.recentTasksCache = []
		return p.recentTasksCache
	}

	workspaceTasks.sort((a, b) => b.ts - a.ts)
	let recentTaskIds: string[] = []

	if (workspaceTasks.length >= 100) {
		const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

		for (const item of workspaceTasks) {
			if (item.ts < sevenDaysAgo) {
				break
			}

			recentTaskIds.push(item.id)
		}
	} else {
		recentTaskIds = workspaceTasks.slice(0, Math.min(100, workspaceTasks.length)).map((item) => item.id)
	}

	p.recentTasksCache = recentTaskIds
	return p.recentTasksCache
}

export async function fetchMarketplaceData(provider: ClineProvider) {
	const p = provider as any
	try {
		const [marketplaceResult, marketplaceInstalledMetadata] = await Promise.all([
			p.marketplaceManager.getMarketplaceItems().catch((error: any) => {
				console.error("Failed to fetch marketplace items:", error)
				return { organizationMcps: [], marketplaceItems: [], errors: [error.message] }
			}),
			p.marketplaceManager.getInstallationMetadata().catch((error: any) => {
				console.error("Failed to fetch installation metadata:", error)
				return { project: {}, global: {} } as MarketplaceInstalledMetadata
			}),
		])

		p.postMessageToWebview({
			type: "marketplaceData",
			organizationMcps: marketplaceResult.organizationMcps || [],
			marketplaceItems: marketplaceResult.marketplaceItems || [],
			marketplaceInstalledMetadata: marketplaceInstalledMetadata || { project: {}, global: {} },
			errors: marketplaceResult.errors,
		})
		p.marketplaceStore?.setMarketplaceData(
			marketplaceResult.marketplaceItems || [],
			marketplaceInstalledMetadata || { project: {}, global: {} },
		)
	} catch (error) {
		console.error("Failed to fetch marketplace data:", error)

		p.postMessageToWebview({
			type: "marketplaceData",
			organizationMcps: [],
			marketplaceItems: [],
			marketplaceInstalledMetadata: { project: {}, global: {} },
			errors: [error instanceof Error ? error.message : String(error)],
		})
		p.marketplaceStore?.setMarketplaceData([], { project: {}, global: {} })

		if (error instanceof Error && error.message.includes("timeout")) {
			vscode.window.showWarningMessage(
				"Marketplace data could not be loaded due to network restrictions. Core functionality remains available.",
			)
		}
	}
}

export async function getState(
	provider: ClineProvider,
): Promise<
	Omit<
		ExtensionState,
		"clineMessages" | "renderContext" | "hasOpenedModeSelector" | "version" | "shouldShowAnnouncement"
	>
> {
	const p = provider as any
	const stateValues = p.contextProxy.getValues()
	const customModes = await p.customModesManager.getCustomModes()

	const apiProvider: ProviderName =
		stateValues.apiProvider && !isRetiredProvider(stateValues.apiProvider) ? stateValues.apiProvider : "anthropic"

	const providerSettings = p.contextProxy.getProviderSettings()

	if (!providerSettings.apiProvider) {
		providerSettings.apiProvider = apiProvider
	}

	let organizationAllowList = ORGANIZATION_ALLOW_ALL

	if (CloudService.hasInstance()) {
		try {
			organizationAllowList = await CloudService.instance.getAllowList()
		} catch (error) {
			console.error(
				`[getState] failed to get organization allow list: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	let cloudUserInfo: CloudUserInfo | null = null

	if (CloudService.hasInstance()) {
		try {
			cloudUserInfo = CloudService.instance.getUserInfo()
		} catch (error) {
			console.error(
				`[getState] failed to get cloud user info: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	let cloudIsAuthenticated: boolean = false

	if (CloudService.hasInstance()) {
		try {
			cloudIsAuthenticated = CloudService.instance.isAuthenticated()
		} catch (error) {
			console.error(
				`[getState] failed to get cloud authentication state: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	let sharingEnabled: boolean = false

	if (CloudService.hasInstance()) {
		try {
			sharingEnabled = await CloudService.instance.canShareTask()
		} catch (error) {
			console.error(
				`[getState] failed to get sharing enabled state: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	let publicSharingEnabled: boolean = false

	if (CloudService.hasInstance()) {
		try {
			publicSharingEnabled = await CloudService.instance.canSharePublicly()
		} catch (error) {
			console.error(
				`[getState] failed to get public sharing enabled state: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	let organizationSettingsVersion: number = -1

	if (CloudService.hasInstance()) {
		try {
			const settings = CloudService.instance.getOrganizationSettings()
			organizationSettingsVersion = settings?.version ?? -1
		} catch (error) {
			console.error(
				`[getState] failed to get organization settings version: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	let taskSyncEnabled: boolean = false

	if (CloudService.hasInstance()) {
		try {
			taskSyncEnabled = CloudService.instance.isTaskSyncEnabled()
		} catch (error) {
			console.error(
				`[getState] failed to get task sync enabled state: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	return {
		apiConfiguration: providerSettings,
		lastShownAnnouncementId: stateValues.lastShownAnnouncementId,
		customInstructions: stateValues.customInstructions,
		apiModelId: stateValues.apiModelId,
		alwaysAllowReadOnly: stateValues.alwaysAllowReadOnly ?? false,
		alwaysAllowReadOnlyOutsideWorkspace: stateValues.alwaysAllowReadOnlyOutsideWorkspace ?? false,
		alwaysAllowWrite: stateValues.alwaysAllowWrite ?? false,
		alwaysAllowWriteOutsideWorkspace: stateValues.alwaysAllowWriteOutsideWorkspace ?? false,
		alwaysAllowWriteProtected: stateValues.alwaysAllowWriteProtected ?? false,
		alwaysAllowExecute: stateValues.alwaysAllowExecute ?? false,
		alwaysAllowMcp: stateValues.alwaysAllowMcp ?? false,
		alwaysAllowModeSwitch: stateValues.alwaysAllowModeSwitch ?? false,
		alwaysAllowSubtasks: stateValues.alwaysAllowSubtasks ?? false,
		alwaysAllowFollowupQuestions: stateValues.alwaysAllowFollowupQuestions ?? false,
		followupAutoApproveTimeoutMs: stateValues.followupAutoApproveTimeoutMs ?? 60000,
		diagnosticsEnabled: stateValues.diagnosticsEnabled ?? true,
		allowedMaxRequests: stateValues.allowedMaxRequests,
		allowedMaxCost: stateValues.allowedMaxCost,
		autoCondenseContext: stateValues.autoCondenseContext ?? true,
		autoCondenseContextPercent: stateValues.autoCondenseContextPercent ?? 100,
		taskHistory: p.taskHistoryStore.getAll(),
		allowedCommands: stateValues.allowedCommands,
		deniedCommands: stateValues.deniedCommands,
		soundEnabled: stateValues.soundEnabled ?? false,
		ttsEnabled: stateValues.ttsEnabled ?? false,
		ttsSpeed: stateValues.ttsSpeed ?? 1.0,
		enableCheckpoints: stateValues.enableCheckpoints ?? true,
		checkpointTimeout: stateValues.checkpointTimeout ?? DEFAULT_CHECKPOINT_TIMEOUT_SECONDS,
		soundVolume: stateValues.soundVolume,
		writeDelayMs: stateValues.writeDelayMs ?? DEFAULT_WRITE_DELAY_MS,
		terminalShellIntegrationTimeout:
			stateValues.terminalShellIntegrationTimeout ?? Terminal.defaultShellIntegrationTimeout,
		terminalShellIntegrationDisabled: stateValues.terminalShellIntegrationDisabled ?? true,
		terminalCommandDelay: stateValues.terminalCommandDelay ?? 0,
		terminalPowershellCounter: stateValues.terminalPowershellCounter ?? false,
		terminalZshClearEolMark: stateValues.terminalZshClearEolMark ?? true,
		terminalZshOhMy: stateValues.terminalZshOhMy ?? false,
		terminalZshP10k: stateValues.terminalZshP10k ?? false,
		terminalZdotdir: stateValues.terminalZdotdir ?? false,
		mode: stateValues.mode ?? defaultModeSlug,
		language: stateValues.language ?? formatLanguage(vscode.env.language),
		mcpEnabled: stateValues.mcpEnabled ?? true,
		mcpServers: p.mcpHub?.getAllServers() ?? [],
		currentApiConfigName: stateValues.currentApiConfigName ?? "default",
		listApiConfigMeta: stateValues.listApiConfigMeta ?? [],
		pinnedApiConfigs: stateValues.pinnedApiConfigs ?? {},
		modeApiConfigs: stateValues.modeApiConfigs ?? ({} as Record<Mode, string>),
		customModePrompts: stateValues.customModePrompts ?? {},
		customSupportPrompts: stateValues.customSupportPrompts ?? {},
		systemPromptTemplates: stateValues.systemPromptTemplates ?? {},
		enhancementApiConfigId: stateValues.enhancementApiConfigId,
		experiments: stateValues.experiments ?? experimentDefault,
		autoApprovalEnabled: stateValues.autoApprovalEnabled ?? false,
		customModes,
		maxOpenTabsContext: stateValues.maxOpenTabsContext ?? 20,
		maxWorkspaceFiles: stateValues.maxWorkspaceFiles ?? 200,
		disabledTools: stateValues.disabledTools,
		telemetrySetting: stateValues.telemetrySetting || "unset",
		showJabberwockIgnoredFiles: stateValues.showJabberwockIgnoredFiles ?? false,
		enableSubfolderRules: stateValues.enableSubfolderRules ?? false,
		maxImageFileSize: stateValues.maxImageFileSize ?? 5,
		maxTotalImageSize: stateValues.maxTotalImageSize ?? 20,
		historyPreviewCollapsed: stateValues.historyPreviewCollapsed ?? false,
		reasoningBlockCollapsed: stateValues.reasoningBlockCollapsed ?? true,
		enterBehavior: stateValues.enterBehavior ?? "send",
		cloudUserInfo,
		cloudIsAuthenticated,
		sharingEnabled,
		publicSharingEnabled,
		organizationAllowList,
		organizationSettingsVersion,
		customCondensingPrompt: stateValues.customCondensingPrompt,
		codebaseIndexModels: stateValues.codebaseIndexModels ?? EMBEDDING_MODEL_PROFILES,
		codebaseIndexConfig: {
			codebaseIndexEnabled: stateValues.codebaseIndexConfig?.codebaseIndexEnabled ?? false,
			codebaseIndexQdrantUrl: stateValues.codebaseIndexConfig?.codebaseIndexQdrantUrl ?? "http://localhost:6333",
			codebaseIndexEmbedderProvider: stateValues.codebaseIndexConfig?.codebaseIndexEmbedderProvider ?? "openai",
			codebaseIndexEmbedderBaseUrl: stateValues.codebaseIndexConfig?.codebaseIndexEmbedderBaseUrl ?? "",
			codebaseIndexEmbedderModelId: stateValues.codebaseIndexConfig?.codebaseIndexEmbedderModelId ?? "",
			codebaseIndexEmbedderModelDimension: stateValues.codebaseIndexConfig?.codebaseIndexEmbedderModelDimension,
			codebaseIndexOpenAiCompatibleBaseUrl: stateValues.codebaseIndexConfig?.codebaseIndexOpenAiCompatibleBaseUrl,
			codebaseIndexSearchMaxResults: stateValues.codebaseIndexConfig?.codebaseIndexSearchMaxResults,
			codebaseIndexSearchMinScore: stateValues.codebaseIndexConfig?.codebaseIndexSearchMinScore,
			codebaseIndexBedrockRegion: stateValues.codebaseIndexConfig?.codebaseIndexBedrockRegion,
			codebaseIndexBedrockProfile: stateValues.codebaseIndexConfig?.codebaseIndexBedrockProfile,
			codebaseIndexOpenRouterSpecificProvider:
				stateValues.codebaseIndexConfig?.codebaseIndexOpenRouterSpecificProvider,
		},
		profileThresholds: stateValues.profileThresholds ?? {},
		lockApiConfigAcrossModes: p.context.workspaceState.get("lockApiConfigAcrossModes", false),
		includeDiagnosticMessages: stateValues.includeDiagnosticMessages ?? true,
		maxDiagnosticMessages: stateValues.maxDiagnosticMessages ?? 50,
		includeTaskHistoryInEnhance: stateValues.includeTaskHistoryInEnhance ?? true,
		includeCurrentTime: stateValues.includeCurrentTime ?? true,
		includeCurrentCost: stateValues.includeCurrentCost ?? true,
		maxGitStatusFiles: stateValues.maxGitStatusFiles ?? 0,
		taskSyncEnabled,
		imageGenerationProvider: stateValues.imageGenerationProvider,
		openRouterImageApiKey: stateValues.openRouterImageApiKey,
		devtoolEnabled: vscode.workspace.getConfiguration(Package.name).get<boolean>("devtool", false),
		locatorTarget: stateValues.locatorTarget ?? "vscode",
	}
}
