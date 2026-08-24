import { types } from "mobx-state-tree"

import { StreamingStoreModel } from "@features/api/store"
import { CheckpointStoreModel } from "@features/foundation/time-machine/store"
import { TaskModel } from "./task/task-store"
import { ToolCallLogEntry } from "./toolcalllogentry/store"
import { StreamingToolCallModel } from "./streamingtoolcall/store"

export const ChatModelDefinition = types.model("Chat", {
	// Domain-specific feature stores (per-task entries)
	streaming: types.optional(StreamingStoreModel, () => ({ entries: {} })),
	checkpoint: types.optional(CheckpointStoreModel, () => ({ entries: {} })),

	// Task management — flattened from former TaskManagerModel
	tasks: types.map(TaskModel),
	activeTaskId: types.maybe(types.string),

	// Chat-level state
	isRunning: types.optional(types.boolean, false),
	toolCallLog: types.array(ToolCallLogEntry),

	// Streaming tool calls (replaces NativeToolCallParser static Maps)
	streamingToolCalls: types.optional(types.map(StreamingToolCallModel), {}),

	// Control flags
	abort: types.optional(types.boolean, false),
	turnResetPending: types.optional(types.boolean, false),
	isCompleted: types.optional(types.boolean, false),
	isPaused: types.optional(types.boolean, false),
	abandoned: types.optional(types.boolean, false),
	skipPrevResponseIdOnce: types.optional(types.boolean, false),

	// Edge case strings
	abortReason: types.maybe(types.string),
	pendingNewTaskToolCallId: types.maybe(types.string),
	completionResultSummary: types.maybe(types.string),
})
