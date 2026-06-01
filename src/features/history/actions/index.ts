import { Instance, getSnapshot } from "mobx-state-tree"
import type { EventBridge } from "../../../features/foundation/webview/EventBridge"
import type { HistoryItem } from "@jabberwock/types"
import { getBackendRootStore } from "@features/storeSingleton"
import { getVscodeContext } from "../../foundation/vscode/context"

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

// ─── Helpers ─────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value)
}

// ─── Standalone functions ─────────────────────────────────────────────

export async function initHistoryState(
	provider: EventBridge,
	ctx?: { getGlobalState?: (key: string) => unknown },
): Promise<void> {
	// MST default factory handles initialization

	// Load persisted task history from VS Code's globalState (via pass-through key).
	// This ensures task history survives extension restart and is shown on the Home screen.
	try {
		const persistedTasks = ctx?.getGlobalState?.("taskHistory")
		if (persistedTasks && Array.isArray(persistedTasks) && persistedTasks.length > 0) {
			const { getBackendRootStore } = await import("@features/storeSingleton")
			const { HistoryTaskModel } = await import("../store")
			const model = getBackendRootStore().history
			if (model) {
				const sanitized = persistedTasks.map((raw: unknown) => {
					const t: Record<string, unknown> = isRecord(raw) ? raw : Object.create(null)
					return HistoryTaskModel.create({
						id: typeof t.id === "string" ? t.id : crypto.randomUUID(),
						task: typeof t.task === "string" ? t.task : "",
						ts: typeof t.ts === "number" ? t.ts : Date.now(),
						tokensIn: typeof t.tokensIn === "number" ? t.tokensIn : 0,
						tokensOut: typeof t.tokensOut === "number" ? t.tokensOut : 0,
						cacheWrites: typeof t.cacheWrites === "number" ? t.cacheWrites : 0,
						cacheReads: typeof t.cacheReads === "number" ? t.cacheReads : 0,
						totalCost: typeof t.totalCost === "number" ? t.totalCost : 0,
						workspace: typeof t.workspace === "string" ? t.workspace : undefined,
						mode: typeof t.mode === "string" ? t.mode : undefined,
						status: typeof t.status === "string" ? t.status : undefined,
						parentTaskId: typeof t.parentTaskId === "string" ? t.parentTaskId : undefined,
						rootTaskId: typeof t.rootTaskId === "string" ? t.rootTaskId : undefined,
						childIds: Array.isArray(t.childIds)
							? t.childIds.filter((c): c is string => typeof c === "string")
							: [],
						number: typeof t.number === "number" ? t.number : undefined,
						size: typeof t.size === "number" ? t.size : undefined,
						apiConfigName: typeof t.apiConfigName === "string" ? t.apiConfigName : undefined,
					})
				})
				model.setItems(sanitized)
			}
		}
	} catch (e) {
		console.error("[jabberwock] Failed to restore task history:", e)
	}
}

import type { IBackendRootStore } from "../../store"

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
export async function getTaskWithId(
	provider: EventBridge,
	id: string,
): Promise<{ historyItem: HistoryTaskItem | undefined }> {
	const state = getHistoryState(getBackendRootStore())
	const items = state?.items ?? []
	const historyItem = items.find((t) => t.id === id)
	return { historyItem }
}

/**
 * Deletes a task from state using MST action.
 */
export async function deleteTaskFromState(provider: EventBridge, taskId: string): Promise<void> {
	const model = getBackendRootStore().history
	model.removeItem(taskId)
	// Serialize snapshot to plain objects for cross-boundary messages
	const rawItems = JSON.parse(JSON.stringify(getSnapshot(model).items))
	// Broadcast the full updated list since an item was removed
	provider.postMessageToWebview({ type: "taskHistoryUpdated", taskHistory: rawItems })
	// Persist deletion to VS Code globalState via pass-through key
	await getVscodeContext().updateGlobalState("taskHistory", rawItems)
}

/**
 * Updates task history using MST actions.
 */
export async function updateTaskHistory(provider: EventBridge, item: Partial<HistoryItem>): Promise<HistoryItem[]> {
	const { HistoryTaskModel } = await import("../store")
	const model = getBackendRootStore().history
	const itemId = String(item.id ?? "")
	const idx = model.items.findIndex((t) => t.id === itemId)
	if (idx >= 0) {
		const update: Partial<Instance<typeof HistoryTaskModel>> = { id: itemId }
		Object.assign(update, item)
		model.updateItem(itemId, update)
		// Send incremental update to webview so it stays in sync without a full state push.
		provider.postMessageToWebview({ type: "taskHistoryItemUpdated", historyItem: item })
	} else {
		model.addItem(
			HistoryTaskModel.create({
				id: itemId,
				task: typeof item.task === "string" ? item.task : "",
				ts: typeof item.ts === "number" ? item.ts : Date.now(),
				tokensIn: typeof item.tokensIn === "number" ? item.tokensIn : 0,
				tokensOut: typeof item.tokensOut === "number" ? item.tokensOut : 0,
				cacheWrites: typeof item.cacheWrites === "number" ? item.cacheWrites : 0,
				cacheReads: typeof item.cacheReads === "number" ? item.cacheReads : 0,
				totalCost: typeof item.totalCost === "number" ? item.totalCost : 0,
				workspace: typeof item.workspace === "string" ? item.workspace : undefined,
				mode: typeof item.mode === "string" ? item.mode : undefined,
				status: typeof item.status === "string" ? item.status : undefined,
				parentTaskId: typeof item.parentTaskId === "string" ? item.parentTaskId : undefined,
				rootTaskId: typeof item.rootTaskId === "string" ? item.rootTaskId : undefined,
				childIds: Array.isArray(item.childIds)
					? item.childIds.filter((c): c is string => typeof c === "string")
					: [],
				number: typeof item.number === "number" ? item.number : undefined,
				size: typeof item.size === "number" ? item.size : undefined,
				apiConfigName: typeof item.apiConfigName === "string" ? item.apiConfigName : undefined,
			}),
		)
		// Broadcast the full updated list since a new item was added
		const rawItems = JSON.parse(JSON.stringify(getSnapshot(model).items))
		provider.postMessageToWebview({ type: "taskHistoryUpdated", taskHistory: rawItems })
	}
	// Persist to VS Code globalState via pass-through key
	const rawStateItems = JSON.parse(JSON.stringify(getSnapshot(model).items))
	await getVscodeContext().updateGlobalState("taskHistory", rawStateItems)
	return rawStateItems
}
