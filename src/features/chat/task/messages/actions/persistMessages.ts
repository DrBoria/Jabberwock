import NodeCache from "node-cache"
import getFolderSize from "get-folder-size"
import { type Notification, type HistoryItem } from "@jabberwock/types"
import { saveTaskMessages } from "."
import { combineApiRequests } from "../../../../../shared/combineApiRequests"
import { combineCommandSequences } from "../../../../../shared/combineCommandSequences"
import { getApiMetrics } from "../../../../../shared/getApiMetrics"
import { findLastIndex } from "../../../../../shared/array"
import { getTaskDirectoryPath } from "../../../../../utils/storage"
import { t } from "../../../../../i18n"
import { defaultModeSlug } from "../../../../../shared/modes"
import { getTask } from "../../actions/taskRegistry"
import { updateTaskHistory } from "../../../../history/actions"
import { getBackendRootStore } from "@features/storeSingleton"

const taskSizeCache = new NodeCache({ stdTTL: 30, checkperiod: 5 * 60 })

export type TaskMetadataOptions = {
	taskId: string
	rootTaskId?: string
	parentTaskId?: string
	taskNumber: number
	messages: Notification[]
	globalStoragePath: string
	workspace: string
	mode?: string
	/** Provider profile name for the task (sticky profile feature) */
	apiConfigName?: string
	/** Initial status for the task (e.g., "active" for child tasks) */
	initialStatus?: "active" | "delegated" | "completed"
}

async function taskMetadata({
	taskId: id,
	rootTaskId,
	parentTaskId,
	taskNumber,
	messages,
	globalStoragePath,
	workspace,
	mode,
	apiConfigName,
	initialStatus,
}: TaskMetadataOptions) {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, id)

	// Determine message availability upfront
	const hasMessages = messages && messages.length > 0

	// Pre-calculate all values based on availability
	let timestamp: number
	let tokenUsage: ReturnType<typeof getApiMetrics>
	let taskDirSize: number
	let taskMessage: Notification | undefined

	if (!hasMessages) {
		// Handle no messages case
		timestamp = Date.now()
		tokenUsage = {
			totalTokensIn: 0,
			totalTokensOut: 0,
			totalCacheWrites: 0,
			totalCacheReads: 0,
			totalCost: 0,
			contextTokens: 0,
		}
		taskDirSize = 0
	} else {
		// Handle messages case
		taskMessage = messages[0] // First message is always the task say.

		const lastRelevantMessage =
			messages[findLastIndex(messages, (m) => !(m.ask === "resume_task" || m.ask === "resume_completed_task"))] ||
			taskMessage

		timestamp = lastRelevantMessage.ts

		tokenUsage = getApiMetrics(combineApiRequests(combineCommandSequences(messages.slice(1))))

		// Get task directory size
		const cachedSize = taskSizeCache.get<number>(taskDir)

		if (cachedSize === undefined) {
			try {
				taskDirSize = await getFolderSize.loose(taskDir)
				taskSizeCache.set<number>(taskDir, taskDirSize)
			} catch (error) {
				taskDirSize = 0
			}
		} else {
			taskDirSize = cachedSize
		}
	}

	// Create historyItem once with pre-calculated values.
	// initialStatus is included when provided (e.g., "active" for child tasks)
	// to ensure the status is set from the very first save, avoiding race conditions
	// where attempt_completion might run before a separate status update.
	const historyItem: HistoryItem = {
		id,
		rootTaskId,
		parentTaskId,
		number: taskNumber,
		ts: timestamp,
		task: hasMessages
			? taskMessage!.text?.trim() || t("common:tasks.incomplete", { taskNumber })
			: t("common:tasks.no_messages", { taskNumber }),
		tokensIn: tokenUsage.totalTokensIn,
		tokensOut: tokenUsage.totalTokensOut,
		cacheWrites: tokenUsage.totalCacheWrites,
		cacheReads: tokenUsage.totalCacheReads,
		totalCost: tokenUsage.totalCost,
		size: taskDirSize,
		workspace,
		mode,
		...(typeof apiConfigName === "string" && apiConfigName.length > 0 ? { apiConfigName } : {}),
		...(initialStatus && { status: initialStatus }),
	}

	return { historyItem, tokenUsage }
}

/**
 * Save messages to disk and sync to MST store.
 * Still requires Task for taskMetadata, token usage, and task history.
 * Messages are read from per-task MST store.
 */
export async function saveMessages(taskId: string): Promise<boolean> {
	const task = getTask(taskId)
	try {
		const messages = getBackendRootStore().chat.tasks.get(taskId)!.notifications.items

		await saveTaskMessages({
			messages: structuredClone(messages),
			taskId: task.taskId,
			globalStoragePath: task.globalStoragePath,
		})

		if (task._state._taskApiConfigName === undefined) {
			await task.taskApiConfigReady
		}

		const { historyItem, tokenUsage } = await taskMetadata({
			taskId: task.taskId,
			rootTaskId: task.rootTaskId,
			parentTaskId: task.parentTaskId,
			taskNumber: task._state.taskNumber,
			messages,
			globalStoragePath: task.globalStoragePath,
			workspace: task.cwd,
			mode: task._state._taskMode || defaultModeSlug,
			apiConfigName: task._state._taskApiConfigName,
			initialStatus: task._state.initialStatus as "active" | "delegated" | "completed" | undefined,
		})

		// Emit token/tool usage updates using debounced function
		task.debouncedEmitTokenUsage!(tokenUsage, task._state.toolUsage)

		const provider = task.providerRef!.deref()
		if (provider) {
			await updateTaskHistory(provider, historyItem)
		}
		return true
	} catch (error) {
		console.error("[jabberwock] Failed to save Jabberwock messages:", error)
		return false
	}
}

/**
 * Find a message by its timestamp (searching from the end).
 * Searches in MST store (messages.messages).
 */
export function findMessageByTimestamp(taskId: string, ts: number): Notification | undefined {
	const messages = getBackendRootStore().chat.tasks.get(taskId)!.notifications.items
	for (let i = messages.length - 1; i >= 0; i--) {
		if (messages[i].ts === ts) {
			return messages[i]
		}
	}
	return undefined
}
