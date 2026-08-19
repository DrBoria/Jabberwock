import { types, Instance } from "mobx-state-tree"

import { vscode } from "@jabberwock/devtool/webview"
import type { WebviewMessage, HistoryItem } from "@jabberwock/types"
import { eventConstants } from "@jabberwock/types"

/**
 * TaskHistoryStore — tracks task history updates.
 * Receives snapshots from the extension-side TaskHistoryStore via MstBridge.
 * Owned by RootStore as a sub-store.
 */
export const TaskHistoryStore = types
	.model("TaskHistoryStore", {
		items: types.array(types.frozen<HistoryItem>()),
	})
	// ── Block 1: Data setters ────────────────────────────────────────────
	.actions((self) => ({
		setItems(items: HistoryItem[]) {
			self.items.replace(items)
		},
		upsertItem(item: HistoryItem) {
			const idx = self.items.findIndex((h: HistoryItem) => h.id === item.id)
			if (idx >= 0) {
				self.items[idx] = item
			} else {
				self.items.unshift(item)
			}
		},
	}))
	// ── Block 2: History actions (formerly createHistoryActions) ─────────
	.actions((_self) => ({
		// ── Export settings ────────────────────────────────────────
		exportSettings() {
			vscode.postMessage({
				type: eventConstants.HISTORY.EXPORT_SETTINGS,
			} satisfies WebviewMessage)
		},

		// ── Import settings ────────────────────────────────────────
		importSettings() {
			vscode.postMessage({
				type: eventConstants.HISTORY.IMPORT_SETTINGS,
			} satisfies WebviewMessage)
		},

		// ── Reset state ────────────────────────────────────────────
		resetState() {
			vscode.postMessage({
				type: eventConstants.HISTORY.RESET_STATE,
			} satisfies WebviewMessage)
		},

		// ── Search commits ─────────────────────────────────────────
		searchCommits(query: string) {
			vscode.postMessage({
				type: eventConstants.HISTORY.SEARCH_COMMITS,
				query,
			} satisfies WebviewMessage)
		},

		// ── Export current task ────────────────────────────────────
		exportCurrentTask() {
			vscode.postMessage({
				type: "exportCurrentTask" as const,
			} satisfies WebviewMessage)
		},

		// ── Delete task with ID ────────────────────────────────────
		deleteTaskWithId(text: string) {
			vscode.postMessage({
				type: "deleteTaskWithId" as const,
				text,
			} satisfies WebviewMessage)
		},

		// ── Export task with ID ────────────────────────────────────
		exportTaskWithId(text: string) {
			vscode.postMessage({
				type: "exportTaskWithId" as const,
				text,
			} satisfies WebviewMessage)
		},

		// ── Delete multiple tasks with IDs ─────────────────────────
		deleteMultipleTasksWithIds(texts: string[]) {
			vscode.postMessage({
				type: "deleteMultipleTasksWithIds" as const,
				text: texts.join(","),
			} satisfies WebviewMessage)
		},
	}))

export type ITaskHistoryStore = Instance<typeof TaskHistoryStore>
// 🔴 DUAL INSTANTIATION BUG: This singleton is registered with MstBridge (index.tsx:49)
// AND RootStore creates a separate instance via types.optional (root-store.ts:200).
// MstBridge patches THIS instance — rootStore.history does NOT receive those patches.
export const taskHistoryStore = TaskHistoryStore.create({ items: [] })
