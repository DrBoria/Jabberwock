// ─── Task Status ────────────────────────────────────────────────────────

export type TaskStatus = "active" | "completed" | "aborted"

// ─── LoopStackItem (used by TaskStateModel.loopStack) ────────────────────

export interface LoopStackItem {
	userContent: import("@anthropic-ai/sdk").Anthropic.Messages.ContentBlockParam[]
	includeFileDetails: boolean
	retryAttempt: number
	userMessageWasRemoved?: boolean
}
