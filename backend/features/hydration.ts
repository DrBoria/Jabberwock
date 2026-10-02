import type { HistoryItem } from "@jabberwock/types"
import { getStore } from "./singleton"
import { buildEnrichedState } from "./foundation/window-manager/lib/window-utils"
import { getHistoryState } from "./hist/actions"

/**
 * BUG-5 (2.4 Web hydration): the WS hello→state handshake used to hand the client the raw
 * NESTED MST root snapshot (`getBackendRootSnapshot`), but the frontend
 * `handleStateReceived` → `store.mergeExtensionState(state)` only applies the FLAT
 * `ExtensionState` shape (the same payload the VS Code webview receives via
 * `postStateToWebview` → `buildEnrichedState`). Nested keys (`history.items`,
 * `settings.apiConfig.*`) matched nothing, so the Web surface fell back to the "default"
 * provider and an empty "Recent Tasks" list.
 *
 * This builder emits the flat shape for WS hydration: the `buildEnrichedState` base (provider
 * config, api config meta, isRunning, context meta) plus the task history and the active
 * task's messages — the same data the VS Code `webview-launched` path delivers via
 * `sendTaskHistory` + `restoreChatState` + `postStateToWebview`.
 */
export function buildHydrationState(): Record<string, unknown> {
	try {
		const state = buildEnrichedState()
		applyTaskHistory(state)
		applyActiveTask(state)
		return state
	} catch {
		// Store not ready or enrichment failed — the client keeps its defaults and the next
		// live state push (postStateToWebview) retries with the full flat payload.
		return { _hydration: true }
	}
}

function applyTaskHistory(state: Record<string, unknown>): void {
	try {
		const history = getHistoryState(getStore())
		if (history.items.length > 0) {
			state.taskHistory = history.items
		}
	} catch {
		// Non-critical — history arrives via live taskHistoryUpdated pushes as well.
	}
}

function applyActiveTask(state: Record<string, unknown>): void {
	try {
		const activeTask = getStore().chat.activeTask
		if (!activeTask) return
		const messages = activeTask.messages ?? []
		if (messages.length === 0) return
		state.currentTaskId = activeTask.taskId
		state.currentTaskItem = {
			id: activeTask.taskId,
			ts: messages[0]?.ts ?? Date.now(),
			task: activeTask.taskId,
			mode: activeTask._taskMode ?? undefined,
		} satisfies Partial<HistoryItem>
		state.messages = messages
	} catch {
		// Non-critical — the active task is restored on the next state push.
	}
}
