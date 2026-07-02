import type { TaskStatus } from "@features/chat/task/task-store/task-state/task-types"
import type { ITaskModel } from "./actions/task-model-actions-goals"
import type { TokenUsage } from "@jabberwock/types"
import type { Notification } from "@jabberwock/types"
import { TaskModelBase } from "@features/chat/task/store"

export const TaskModelWithViews = TaskModelBase.views((self) => ({
	// ── Computed state ────────────────────────────────────────────────
	get taskStatus(): TaskStatus {
		if (self.abort) return "aborted"
		if (self.isCompleted) return "completed"
		return "active"
	},
	get taskMode(): string | undefined {
		return self._taskMode
	},
	get taskApiConfigName(): string | undefined {
		return self._taskApiConfigName
	},
	get cwd(): string {
		return self.workspacePath
	},

	// ── Cursor-based notification views ──────────────────────────
	get pendingNotifications(): Notification[] {
		return self.notifications.items.slice(self.cursor)
	},
	get hasPendingNotifications(): boolean {
		return self.cursor < self.notifications.items.length
	},

	// ── Backward compat: _state returns self ──────────────────────
	get _state(): ITaskModel {
		return self as ITaskModel
	},

	// ── Token usage (from snapshot cache) ─────────────────────────────
	get tokenUsage(): TokenUsage | undefined {
		if (self.tokenUsageSnapshot && self.tokenUsageSnapshotAt) {
			return self.tokenUsageSnapshot
		}
		return self.tokenUsageSnapshot
	},

	// ── Streaming tool call indices (Map wrapper) ─────────────────────
	get streamingIndices(): Map<string, number> {
		return new Map(self.streamingToolCallIndexEntries)
	},
}))
