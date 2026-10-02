import crypto from "crypto"
import { v7 as uuidv7 } from "uuid"
import * as path from "path"
import * as os from "os"

import type { ProviderSettings } from "@jabberwock/types"

import type { ITaskModel } from "@features/chat/task"
import type { ProviderHandle } from "@features/foundation"
import { getStore } from "@features/singleton"
import { getWorkspacePath } from "@utils/io/main"
import { createAttemptApiRequest } from "@features/api"
// Leaf imports (not the messages/actions barrel) to avoid an import cycle:
// the barrel re-exports updateMessage, which imports back into this actions barrel.
import { getSavedMessages } from "@features/chat/task/messages/actions/command/getSavedMessages"
import { getSavedApiConversationHistory } from "@features/chat/task/messages/actions/save/io"

export interface CreateTaskModelOptions {
	provider: ProviderHandle
	apiConfiguration: ProviderSettings
	historyItem?: {
		id: string
		rootTaskId?: string
		parentTaskId?: string
		mode?: string
		apiConfigName?: string
		task?: string
	}
	task?: string
	images?: string[]
	taskId?: string
	taskNumber: number
	workspacePath?: string
	mode?: string
	consecutiveMistakeLimit?: number
}

/**
 * Creates a new ITaskModel instance directly through the MST store,
 * replacing the legacy `new Task()` constructor.
 *
 * Sets up the necessary volatile properties that were previously handled
 * by the Task class constructor.
 */
function resolveTaskMode(explicitMode: string | undefined, historyItem: CreateTaskModelOptions["historyItem"]): string {
	return explicitMode ?? historyItem?.mode ?? "code"
}

function resolveIdentityValues(options: CreateTaskModelOptions) {
	const { historyItem, taskId: explicitTaskId, workspacePath: explicitWorkspacePath } = options
	const resolvedTaskId = historyItem ? historyItem.id : explicitTaskId || uuidv7()
	return {
		resolvedTaskId,
		resolvedRootTaskId: historyItem?.rootTaskId ?? resolvedTaskId,
		resolvedParentTaskId: historyItem?.parentTaskId,
		resolvedWorkspacePath: explicitWorkspacePath ?? getWorkspacePath(path.join(os.homedir(), "Desktop")),
		resolvedInstanceId: crypto.randomUUID().slice(0, 8),
	}
}

export function createTaskModel(options: CreateTaskModelOptions): ITaskModel {
	const {
		provider,
		apiConfiguration,
		historyItem,
		task: _text,
		taskNumber,
		mode: explicitMode,
		consecutiveMistakeLimit,
	} = options
	const store = getStore()

	// ── Compute identity values ──────────────────────────────────
	const identity = resolveIdentityValues(options)

	// ── Create MST model instance (single source of truth) ───────
	const model = store.chat.createTask({
		taskId: identity.resolvedTaskId,
		instanceId: identity.resolvedInstanceId,
		rootTaskId: identity.resolvedRootTaskId,
		parentTaskId: identity.resolvedParentTaskId,
		childTaskIds: [],
		taskNumber,
		workspacePath: identity.resolvedWorkspacePath,
		apiConfiguration,
		consecutiveMistakeLimit,
	})

	// ── Set up volatile properties (migrated from "Task" class) ────
	model.setGlobalStoragePath(provider.context.globalStorageUri.fsPath)
	model.setTaskMode(resolveTaskMode(explicitMode, historyItem))
	model.setTaskModeReady(Promise.resolve())

	if (historyItem) {
		model.setAskResolve(undefined)
	}

	console.log(`[createTaskModel] Setting attemptApiRequest on task ${model.taskId}`)
	model.setAttemptApiRequest((retryAttempt, opts) => createAttemptApiRequest(model, retryAttempt, opts))
	console.log(`[createTaskModel] attemptApiRequest is now: ${typeof model.attemptApiRequest}`)

	// ── Wire persisted-state readers (migrated from the legacy Task class) ──
	// Without these, resumeTaskFromHistory reads [] and overwriteMessages would
	// clobber the saved ui_messages.json with an empty array.
	model.setSavedMessagesReader(() => getSavedMessages(model.taskId, model.globalStoragePath))
	model.setSavedApiConversationHistoryReader(() =>
		getSavedApiConversationHistory(model.taskId, model.globalStoragePath),
	)

	return model
}
