import { types, Instance, getSnapshot } from "mobx-state-tree"
import type { EventBridge } from "../../core/webview/EventBridge"
import { getState } from "../storeSingleton"

/**
 * MST model for a single task history item.
 * Uses types.frozen() for the flexible metadata fields since
 * TaskHistoryItem shape comes from the extension API.
 */
export const HistoryTaskModel = types.model("HistoryTask", {
	id: types.string,
	task: types.frozen<Record<string, unknown>>(),
	ts: types.number,
	tokensIn: types.number,
	tokensOut: types.number,
	cacheWrites: types.optional(types.number, 0),
	cacheReads: types.optional(types.number, 0),
	totalCost: types.number,
	workspace: types.maybe(types.string),
	mode: types.maybe(types.string),
	status: types.maybe(types.string),
	parentTaskId: types.maybe(types.string),
	rootTaskId: types.maybe(types.string),
	childIds: types.optional(types.array(types.string), []),
	number: types.maybe(types.number),
	size: types.maybe(types.number),
	apiConfigName: types.maybe(types.string),
})

export const HistoryModel = types
	.model("History", {
		items: types.array(HistoryTaskModel),
		currentTaskId: types.string,
	})
	.actions((self) => ({
		setItems(items: Instance<typeof HistoryTaskModel>[]) {
			self.items.replace(items)
		},
		addItem(item: Instance<typeof HistoryTaskModel>) {
			self.items.push(item)
		},
		updateItem(id: string, update: Partial<Instance<typeof HistoryTaskModel>>) {
			const idx = self.items.findIndex((i) => i.id === id)
			if (idx !== -1) {
				Object.assign(self.items[idx], update)
			}
		},
		removeItem(id: string) {
			self.items.replace(self.items.filter((i) => i.id !== id))
		},
		setCurrentTaskId(id: string) {
			self.currentTaskId = id
		},
	}))

export type IHistoryModel = Instance<typeof HistoryModel>

// Backward-compatible interface
export interface HistoryState {
	items: HistoryTaskItem[]
	currentTaskId: string | null
}

// ─── Backward-compatible init/get ──────────────────────────────────────

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
			const { getState } = await import("../storeSingleton")
			const model = getState(provider).history as IHistoryModel
			if (model) {
				const sanitized = persistedTasks.map((t: Record<string, unknown>) => ({
					id: String(t.id ?? ""),
					task: (t.task ?? {}) as Record<string, unknown>,
					ts: typeof t.ts === "number" ? t.ts : 0,
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
					childIds: Array.isArray(t.childIds) ? t.childIds : [],
					number: typeof t.number === "number" ? t.number : undefined,
					size: typeof t.size === "number" ? t.size : undefined,
					apiConfigName: typeof t.apiConfigName === "string" ? t.apiConfigName : undefined,
				}))
				const taskInstances = sanitized.map((s) => HistoryTaskModel.create(s))
				model.setItems(taskInstances)
			}
		}
	} catch {
		// Non-critical — run with empty history on first launch
	}
}

// ─── History task item interface ────────────────────────────────────────

export interface HistoryTaskItem extends Record<string, unknown> {
	id: string
	task: Record<string, unknown>
	parentTaskId?: string
	childIds?: string[]
	ts: number
	status?: string
	tokensIn?: number
	tokensOut?: number
	cacheWrites?: number
	cacheReads?: number
	totalCost?: number
}

export function getHistoryState(provider: EventBridge): HistoryState {
	const model = getState(provider).history
	const snapshot = getSnapshot(model)
	return {
		items: snapshot.items as HistoryTaskItem[],
		currentTaskId: snapshot.currentTaskId as string | null,
	}
}

// ─── Helper functions ─────────────────────────────────────────────────

/**
 * Gets a task by ID from history state.
 */
export async function getTaskWithId(
	provider: EventBridge,
	id: string,
): Promise<{ historyItem: HistoryTaskItem | undefined }> {
	const state = getHistoryState(provider)
	const items = state?.items ?? []
	const historyItem = items.find((t) => (t as HistoryTaskItem).id === id) as HistoryTaskItem | undefined
	return { historyItem }
}

/**
 * Deletes a task from state using MST action.
 */
export async function deleteTaskFromState(provider: EventBridge, taskId: string): Promise<void> {
	const model = getState(provider).history as IHistoryModel
	model.removeItem(taskId)
	// Serialize snapshot to plain objects for cross-boundary messages
	const rawItems = JSON.parse(JSON.stringify(getSnapshot(model).items))
	// Broadcast the full updated list since an item was removed
	provider.postMessageToWebview({ type: "taskHistoryUpdated", taskHistory: rawItems }).catch(() => {})
	// Persist deletion to VS Code globalState via pass-through key
	await provider.updateGlobalState("taskHistory", rawItems).catch(() => {})
}

/**
 * Updates task history using MST actions.
 */
export async function updateTaskHistory(
	provider: EventBridge,
	item: Record<string, unknown>,
	_options?: Record<string, unknown>,
): Promise<Record<string, unknown>[]> {
	const model = getState(provider).history as IHistoryModel
	const itemId = String(item.id ?? "")
	const idx = model.items.findIndex((t) => t.id === itemId)
	if (idx >= 0) {
		model.updateItem(itemId, {
			...item,
			id: itemId,
		} as Partial<Instance<typeof HistoryTaskModel>>)
		// Send incremental update to webview so it stays in sync without a full state push.
		provider.postMessageToWebview({ type: "taskHistoryItemUpdated", historyItem: item }).catch(() => {})
	} else {
		model.addItem(HistoryTaskModel.create(item))
		// Broadcast the full updated list since a new item was added
		const rawItems = JSON.parse(JSON.stringify(getSnapshot(model).items))
		provider.postMessageToWebview({ type: "taskHistoryUpdated", taskHistory: rawItems }).catch(() => {})
	}
	// Persist to VS Code globalState via pass-through key
	const rawStateItems = JSON.parse(JSON.stringify(getSnapshot(model).items))
	await provider.updateGlobalState("taskHistory", rawStateItems).catch(() => {})
	return rawStateItems
}
