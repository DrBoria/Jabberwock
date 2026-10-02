import { getSnapshot } from "mobx-state-tree"

import type { ProviderHandle } from "@features/foundation"

import type { HistoryItem } from "@jabberwock/types"

import { getStore } from "@features/singleton"

import { getHostEnvironment, log as backendLog } from "@features/foundation"

import { sanitizeHistoryItem } from "@features/hist"

import { sendTaskHistoryUpdated, sendTaskHistoryItemUpdated } from "@features/settings"

import type { IBackendRootStore } from "@features/store"

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

function restorePersistedTasks(persistedTasks: unknown): void {
	if (!Array.isArray(persistedTasks) || persistedTasks.length === 0) return
	const model = getStore().history
	if (!model) {
		backendLog.info("[initHistoryState] model missing — skipped restore")
		return
	}
	const sanitized = persistedTasks.map((raw: unknown) => sanitizeHistoryItem(raw))
	model.setItems(sanitized)
	backendLog.info(`[initHistoryState] restored ${sanitized.length} task(s) into MST store`)
}

export async function initHistoryState(
	provider: ProviderHandle,
	ctx?: { getGlobalState?: (key: string) => unknown },
): Promise<void> {
	try {
		const persistedTasks = ctx?.getGlobalState?.("taskHistory")
		backendLog.info(
			`[initHistoryState] getGlobalState("taskHistory") -> ${
				Array.isArray(persistedTasks) ? `array(${persistedTasks.length})` : String(persistedTasks)
			}`,
		)
		restorePersistedTasks(persistedTasks)
	} catch (e) {
		backendLog.info(`[initHistoryState] FAILED: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`)
	}
}

export function getHistoryState(rootStore: IBackendRootStore): HistoryState {
	const model = rootStore.history
	const snapshot = getSnapshot(model)
	return {
		items: snapshot.items,
		currentTaskId: snapshot.currentTaskId,
	}
}

/**
 * Gets a task by ID from "history" state.
 */
export async function getTaskWithId(id: string): Promise<{ historyItem: HistoryTaskItem | undefined }> {
	const state = getHistoryState(getStore())
	const items = state?.items ?? []
	const historyItem = items.find((t) => t.id === id)
	return { historyItem }
}

/**
 * Deletes a task from "state" using MST action.
 */
export async function deleteTaskFromState(taskId: string): Promise<void> {
	const model = getStore().history
	model.removeItem(taskId)
	const rawItems = JSON.parse(JSON.stringify(getSnapshot(model).items))
	sendTaskHistoryUpdated(rawItems)
	await getHostEnvironment().updateGlobalState("taskHistory", rawItems)
}

/**
 * Updates task history using MST actions.
 */
export async function updateTaskHistory(item: Partial<HistoryItem>): Promise<HistoryItem[]> {
	const model = getStore().history
	const itemId = String(item.id ?? "")
	const idx = model.items.findIndex((t) => t.id === itemId)
	if (idx >= 0) {
		const update: Partial<HistoryItem> = { id: itemId }
		Object.assign(update, item)
		model.updateItem(itemId, update)
		sendTaskHistoryItemUpdated(item)
	} else {
		model.addItem(sanitizeHistoryItem({ ...item, id: itemId }))
		const rawItems = JSON.parse(JSON.stringify(getSnapshot(model).items))
		sendTaskHistoryUpdated(rawItems)
	}
	const rawStateItems = JSON.parse(JSON.stringify(getSnapshot(model).items))
	await getHostEnvironment().updateGlobalState("taskHistory", rawStateItems)
	return rawStateItems
}
