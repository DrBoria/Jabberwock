import crypto from "crypto"
import { v7 as uuidv7 } from "uuid"
import * as path from "path"
import * as os from "os"

import type { ProviderSettings } from "@jabberwock/types"

import type { ITaskModel } from "../store"
import type { EventBridge } from "../../../foundation/webview/EventBridge"
import { getBackendRootStore } from "@features/storeSingleton"
import { getWorkspacePath } from "../../../../utils/path"

export interface CreateTaskModelOptions {
	provider: EventBridge
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
	taskNumber?: number
	workspacePath?: string
}

/**
 * Creates a new ITaskModel instance directly through the MST store,
 * replacing the legacy `new Task()` constructor.
 *
 * Sets up the necessary volatile properties that were previously handled
 * by the Task class constructor.
 */
export function createTaskModel(options: CreateTaskModelOptions): ITaskModel {
	const {
		provider,
		apiConfiguration,
		historyItem,
		task: text,
		images,
		taskId: explicitTaskId,
		taskNumber = -1,
		workspacePath: explicitWorkspacePath,
	} = options

	const store = getBackendRootStore()

	// ── Compute identity values ──────────────────────────────────
	const resolvedTaskId = historyItem ? historyItem.id : explicitTaskId || uuidv7()

	const resolvedRootTaskId = historyItem?.rootTaskId ?? resolvedTaskId
	const resolvedParentTaskId = historyItem?.parentTaskId
	const resolvedWorkspacePath = explicitWorkspacePath ?? getWorkspacePath(path.join(os.homedir(), "Desktop"))
	const resolvedInstanceId = crypto.randomUUID().slice(0, 8)

	// ── Create MST model instance (single source of truth) ───────
	const model = store.chat.createTask({
		taskId: resolvedTaskId,
		instanceId: resolvedInstanceId,
		rootTaskId: resolvedRootTaskId,
		parentTaskId: resolvedParentTaskId,
		childTaskIds: [],
		taskNumber,
		workspacePath: resolvedWorkspacePath,
		apiConfiguration,
	})

	// ── Set up volatile properties (migrated from Task class) ────
	model.providerRef = new WeakRef(provider)
	model.globalStoragePath = provider.context.globalStorageUri.fsPath

	// Initialize mode/api-config promises based on whether we're resuming
	if (historyItem) {
		model.askResolve = undefined
	}

	return model
}
