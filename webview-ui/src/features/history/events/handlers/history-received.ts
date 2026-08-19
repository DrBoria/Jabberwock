import type { IntentBus } from "../../../intents/bus"
import { IntentConstants } from "@intentConstants"
import type { IntentHandlerContext } from "../../../intents/context"
import { getRootStore } from "../../../root-store"
import type { HistoryItem } from "@jabberwock/types"

/**
 * Register all frontend history event handlers on the IntentBus.
 */
export function registerOnFrontendHistoryIntents(bus: IntentBus): void {
	bus.register(IntentConstants.history.UPDATED, async (intent, _ctx: IntentHandlerContext) => {
		const store = getRootStore()
		const payload = intent.payload as { taskHistory?: unknown }
		if (payload.taskHistory !== undefined) {
			store.extensionState = { ...store.extensionState, taskHistory: payload.taskHistory as HistoryItem[] }
		}
	})

	bus.register(IntentConstants.history.ITEM_UPDATED, async (intent, _ctx: IntentHandlerContext) => {
		const store = getRootStore()
		const payload = intent.payload as { historyItem?: HistoryItem; taskHistory?: unknown[] }
		const item = payload.historyItem
		if (!item) return
		const currentHistory = store.extensionState.taskHistory
		const existingIndex = currentHistory.findIndex((h: HistoryItem) => h.id === item.id)
		let nextHistory: HistoryItem[]
		if (existingIndex === -1) {
			nextHistory = [item, ...currentHistory]
		} else {
			nextHistory = [...currentHistory]
			nextHistory[existingIndex] = item
		}
		nextHistory.sort((a: HistoryItem, b: HistoryItem) => b.ts - a.ts)
		// Merge goals/goalsHistory: prefer incoming item's data, fall back to current live state
		const existingItem = store.extensionState.currentTaskItem
		const mergedItem: HistoryItem = {
			...item,
			goals: item.goals ?? existingItem?.goals,
			goalsHistory: item.goalsHistory ?? existingItem?.goalsHistory,
		}
		const currentTaskItem = !existingItem || existingItem.id === item.id ? mergedItem : existingItem
		store.extensionState = { ...store.extensionState, taskHistory: nextHistory as HistoryItem[], currentTaskItem }
	})
}
