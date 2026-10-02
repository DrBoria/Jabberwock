import { createTaskModel } from "@features/chat"
import type { ProviderHandle } from "@features/foundation"
import { postStateToWebview } from "@features/foundation"
import type { Goal, ProviderSettings } from "@jabberwock/types"
import { DEFAULT_CONSECUTIVE_MISTAKE_LIMIT, historyItemSchema } from "@jabberwock/types"
import type { HistoryTaskItem } from "@features/hist"
import type { ITaskModel } from "@features/chat/task"
import { getStore } from "@features/singleton"
import { registerTask } from "@features/chat"
import { startTask } from "./main"
import { removeZombieTask, resolveTaskId, resolveGoals } from "./registry"
import { resumeActiveTask } from "@features/chat"
import { restoreTaskMessages, resumeTaskFromHistory } from "@features/chat/task/actions/resumeTask"

import type { IBackendRootStore } from "@features/store"

/**
 * Re-opening an already-created task: reuse the existing model instead of
 * re-putting the same id (MST throws "Cannot modify" on duplicate put).
 * Pushes the restored messages to the webview. Returns the existing model,
 * or undefined when no task with that id exists.
 */
async function reopenExistingTask(
	rootStore: IBackendRootStore,
	provider: ProviderHandle,
	historyItem: HistoryTaskItem,
): Promise<ITaskModel | undefined> {
	const existing = rootStore.chat.tasks.get(historyItem.id)
	if (!existing) return undefined
	rootStore.chat.setCurrentTask(existing.taskId)
	await restoreTaskMessages(existing)
	const restoredMessages = existing.notifications.items
	await postStateToWebview(provider, {
		messages: restoredMessages,
		currentTaskItem: {
			id: existing.taskId,
			ts: restoredMessages[0]?.ts ?? Date.now(),
			task: historyItem.task ?? "",
		},
	})
	return existing
}

function resolveMistakeLimit(rawConfig: ProviderSettings | undefined): number {
	const raw = rawConfig?.consecutiveMistakeLimit
	return typeof raw === "number" && raw > 0 ? raw : DEFAULT_CONSECUTIVE_MISTAKE_LIMIT
}

// HistoryTaskItem has optional numeric fields; the schema requires them —
// normalize with zero defaults before parsing.
function normalizeHistoryItem(historyItem: HistoryTaskItem) {
	return historyItemSchema.parse({
		id: historyItem.id,
		rootTaskId: historyItem.rootTaskId,
		parentTaskId: historyItem.parentTaskId,
		number: historyItem.number ?? 0,
		ts: historyItem.ts,
		task: historyItem.task,
		tokensIn: historyItem.tokensIn ?? 0,
		tokensOut: historyItem.tokensOut ?? 0,
		cacheWrites: historyItem.cacheWrites,
		cacheReads: historyItem.cacheReads,
		totalCost: historyItem.totalCost ?? 0,
		size: historyItem.size,
		workspace: historyItem.workspace,
		mode: historyItem.mode,
		apiConfigName: historyItem.apiConfigName,
		status: historyItem.status,
		childIds: historyItem.childIds,
	})
}

/**
 * Creates a NEW task from a saved history item and pushes the restored messages
 * to the webview BEFORE the blocking resume prompt. Shared by the show-task handler
 * and the resume/checkpoint-restore flows so the conversation is always visible.
 */
export async function createTaskFromHistoryItem(
	rootStore: IBackendRootStore,
	provider: ProviderHandle,
	historyItem: HistoryTaskItem,
): Promise<ITaskModel> {
	const reopened = await reopenExistingTask(rootStore, provider, historyItem)
	if (reopened) return reopened

	const apiModel = rootStore.settings.apiConfig
	const rawConfig = apiModel.toProviderSettings()
	const consecutiveMistakeLimit = resolveMistakeLimit(rawConfig)

	const taskNumber = rootStore.chat.tasks.size + 1
	// createTaskModel already inserts the task into rootStore.chat (and the
	// module registry) — calling createTask a second time with the same id
	// violates MST ("Cannot modify TaskModel@/chat/tasks/<id>").
	const normalizedItem = normalizeHistoryItem(historyItem)

	const newTask = createTaskModel({
		provider,
		apiConfiguration: rawConfig,
		consecutiveMistakeLimit,
		historyItem: normalizedItem,
		taskNumber,
	})

	// Restore persisted messages into the MST notifications store FIRST (non-blocking),
	// then push them to the webview. resumeTaskFromHistory() blocks on
	// `await ask(...)` (the resume prompt), so awaiting it before the push would
	// leave the webview without any messages until the user answers.
	await restoreTaskMessages(newTask)
	const restoredMessages = newTask.notifications.items
	await postStateToWebview(provider, {
		messages: restoredMessages,
		currentTaskItem: {
			id: newTask.taskId,
			ts: restoredMessages[0]?.ts ?? Date.now(),
			task: historyItem.task ?? "",
		},
	})

	// Fire-and-forget: the resume prompt (ask) and post-response task continuation
	// run in the background; message updates flow to the webview incrementally.
	void resumeTaskFromHistory(newTask)

	return newTask
}

export async function createTaskWithHistoryItem(
	provider: ProviderHandle,
	historyItem: HistoryTaskItem | undefined,
): Promise<void> {
	if (!historyItem) return
	const store = getStore()
	const currentTask = store.chat.activeTask

	// In-place resume: the requested history item is the task already open in the
	// webview (e.g. checkpoint restore). Re-populate its messages and push state;
	// do NOT spawn a second task for the same id.
	if (currentTask && currentTask.taskId === historyItem.id) {
		await restoreTaskMessages(currentTask)
		const restoredMessages = currentTask.notifications.items
		await postStateToWebview(provider, {
			messages: restoredMessages,
			currentTaskItem: {
				id: currentTask.taskId,
				ts: restoredMessages[0]?.ts ?? Date.now(),
				task: historyItem.task ?? "",
			},
		})
		return
	}

	// Otherwise create a fresh task from the history item (show-task / resume-requested).
	await createTaskFromHistoryItem(store, provider, historyItem)
}

async function createFreshTask(
	store: IBackendRootStore,
	provider: ProviderHandle,
	text: string,
	images?: string[],
	taskConfiguration?: { [key: string]: unknown },
	goals?: Goal[],
	mode?: string,
): Promise<ITaskModel> {
	const apiModel = store.settings.apiConfig
	const rawConfig = apiModel.toProviderSettings()
	const isProviderSettings = (v: { [key: string]: unknown }): v is ProviderSettings =>
		typeof v === "object" && v !== null

	if (!isProviderSettings(rawConfig)) {
		throw new Error("Invalid provider settings from MST store")
	}

	const resolvedTaskId = resolveTaskId(taskConfiguration)
	const taskNumber = store.chat.tasks.size + 1
	// The mistake-limit guard is the only stop mechanism for the model/tool loop.
	// Legacy profiles persist consecutiveMistakeLimit as 0 (snapshot default) or
	// omit it entirely, both of which previously disabled the guard and let the
	// task loop forever; fall back to the documented default in those cases.
	const profileMistakeLimit = rawConfig?.consecutiveMistakeLimit
	const consecutiveMistakeLimit =
		taskConfiguration && "consecutiveMistakeLimit" in taskConfiguration
			? (taskConfiguration.consecutiveMistakeLimit as number)
			: profileMistakeLimit && profileMistakeLimit > 0
				? profileMistakeLimit
				: DEFAULT_CONSECUTIVE_MISTAKE_LIMIT
	const newTask = createTaskModel({
		provider,
		apiConfiguration: rawConfig,
		task: text,
		images: images ?? [],
		taskId: resolvedTaskId,
		taskNumber,
		mode,
		consecutiveMistakeLimit,
	})

	if (typeof newTask.setGoals === "function") {
		const resolvedGoals = resolveGoals(text, goals)

		if (resolvedGoals.length > 0) {
			newTask.setGoals(resolvedGoals)
		}
	}

	registerTask(newTask.taskId, newTask)
	await startTask(newTask.taskId, text, images)

	return newTask
}

export async function createTask(
	provider: ProviderHandle,
	text?: string,
	images?: string[],
	taskConfiguration?: { [key: string]: unknown },
	_extra?: unknown,
	goals?: Goal[],
	mode?: string,
): Promise<ITaskModel> {
	const store = getStore()
	const currentTask = store.chat.activeTask

	if (currentTask && text) {
		if (!currentTask.isInitialized && !currentTask.isCompleted && !currentTask.isStreaming) {
			removeZombieTask(store, currentTask)
		} else if (currentTask.taskStatus === "active") {
			return resumeActiveTask(store, currentTask, provider, text, images)
		}
	}

	if (text) {
		return createFreshTask(store, provider, text, images, taskConfiguration, goals, mode)
	}

	throw new Error("Cannot create task: no text provided")
}
