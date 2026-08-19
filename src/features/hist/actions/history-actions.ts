import { Instance, getSnapshot } from "mobx-state-tree"
import type { ProviderHandle } from "@features/foundation/webview/EventBridge"
import type { HistoryItem } from "@jabberwock/types"
import { getBackendRootStore } from "@features/storeSingleton"
import { getVscodeContext } from "@features/foundation/vscode/context"
import { HistoryTaskModel } from "@features/hist/store"
import { sanitizeHistoryItem } from "@features/hist/actions/sanitizeHistoryItem"
import { sendTaskHistoryUpdated, sendTaskHistoryItemUpdated } from "@features/settings/events/actions/sendSettingsEvent"
// ─── Types ────────────────────────────────────────────────────────────

export interface HistoryTaskItem {
	id: string
	task: string
	parentTaskId?: string
	rootTaskId?: string
	childIds?: string[]
	ts: number
	status?: string
	tokensIn?: number
	tokensOut?: number
	cacheWrites?: number
	cacheReads?: number
	totalCost?: number
	number?: number
	size?: number
	workspace?: string
	mode?: string
	apiConfigName?: string
}

export interface HistoryState {
	items: HistoryTaskItem[]
	currentTaskId: string | null
}

// ─── Standalone functions ─────────────────────────────────────────────

export async function initHistoryState(
	provider: ProviderHandle,
	ctx?: { getGlobalState?: (key: string) => unknown },
): Promise<void> {
	try {
		const persistedTasks = ctx?.getGlobalState?.("taskHistory")
		if (persistedTasks && Array.isArray(persistedTasks) && persistedTasks.length > 0) {
			const model = getBackendRootStore().history
			if (model) {
				const sanitized = persistedTasks.map((raw: unknown) =>
					HistoryTaskModel.create(sanitizeHistoryItem(raw)),
				)
				model.setItems(sanitized)
			}
		}
	} catch (e) {
		console.error("[jabberwock] Failed to restore task history:", e)
	}
}

import type { IBackendRootStore } from "@features/store"

export function getHistoryState(rootStore: IBackendRootStore): HistoryState {
	const model = rootStore.history
	const snapshot = getSnapshot(model)
	return {
		items: snapshot.items,
		currentTaskId: snapshot.currentTaskId,
	}
}

/**
 * Gets a task by ID from history state.
 */
export async function getTaskWithId(id: string): Promise<{ historyItem: HistoryTaskItem | undefined }> {
	const state = getHistoryState(getBackendRootStore())
	const items = state?.items ?? []
	const historyItem = items.find((t) => t.id === id)
	return { historyItem }
}

/**
 * Deletes a task from state using MST action.
 */
export async function deleteTaskFromState(taskId: string): Promise<void> {
	const model = getBackendRootStore().history
	model.removeItem(taskId)
	const rawItems = JSON.parse(JSON.stringify(getSnapshot(model).items))
	sendTaskHistoryUpdated(rawItems)
	await getVscodeContext().updateGlobalState("taskHistory", rawItems)
}

/**
 * Updates task history using MST actions.
 */
export async function updateTaskHistory(item: Partial<HistoryItem>): Promise<HistoryItem[]> {
	const model = getBackendRootStore().history
	const itemId = String(item.id ?? "")
	const idx = model.items.findIndex((t) => t.id === itemId)
	if (idx >= 0) {
		const update: Partial<Instance<typeof HistoryTaskModel>> = { id: itemId }
		Object.assign(update, item)
		model.updateItem(itemId, update)
		sendTaskHistoryItemUpdated(item)
	} else {
		model.addItem(HistoryTaskModel.create(sanitizeHistoryItem({ ...item, id: itemId })))
		const rawItems = JSON.parse(JSON.stringify(getSnapshot(model).items))
		sendTaskHistoryUpdated(rawItems)
	}
	const rawStateItems = JSON.parse(JSON.stringify(getSnapshot(model).items))
	await getVscodeContext().updateGlobalState("taskHistory", rawStateItems)
	return rawStateItems
}
