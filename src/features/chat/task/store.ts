import { types } from "mobx-state-tree"
import type { ProviderSettings, ToolUsage, TodoItem, Goal } from "@jabberwock/types"
import type { LoopStackItem } from "./task-store/task-state/task-types"
import type { Notification } from "@jabberwock/types"
import { createTaskVolatileState } from "@features/chat/task/volatile-state"
import type { ITaskModel as _ITaskModel } from "@features/chat/task/task-store"
export type { _ITaskModel as ITaskModel }

// ─── NotificationsModel ─────────────────────────────────────────────
export const TaskNotificationsModel = types
	.model("Task", {
		items: types.array(types.frozen<Notification>()),
	})
	.actions((self) => ({
		addNotification(msg: Notification) {
			self.items.push(msg)
		},
		setNotifications(items: Notification[]) {
			self.items.replace(items)
		},
		updateNotification(index: number, msg: Notification) {
			if (index >= 0 && index < self.items.length) {
				self.items[index] = msg
			}
		},
		clearNotifications() {
			self.items.clear()
		},
	}))

// ─── TaskModelBase ───────────────────────────────────────────────────
export const TaskModelBase = types
	.model("Task", {
		// ── Identity (required, no optional/maybe) ────────────────────
		taskId: types.identifier,
		instanceId: types.string,
		rootTaskId: types.maybe(types.string),
		childTaskIds: types.array(types.string),

		// ── Edge cases (true maybes) ──────────────────────────────────
		parentTaskId: types.maybe(types.string),
		childTaskId: types.maybe(types.string),

		// ── Instance metadata ─────────────────────────────────────────
		taskNumber: types.integer,
		workspacePath: types.string,

		// ── Control flags (explicit at creation — no types.optional) ──
		abort: types.boolean,
		turnResetPending: types.boolean,
		isCompleted: types.boolean,
		isAsync: types.boolean,
		isInitialized: types.boolean,
		isPaused: types.boolean,
		abandoned: types.boolean,
		skipPrevResponseIdOnce: types.boolean,

		// ── Edge case strings ─────────────────────────────────────────
		abortReason: types.maybe(types.string),
		pendingNewTaskToolCallId: types.maybe(types.string),
		completionResultSummary: types.maybe(types.string),
		initialStatus: types.maybe(types.string),

		// ── Mode / API config (may not be set initially) ──────────────
		_taskMode: types.maybe(types.string),
		_taskApiConfigName: types.maybe(types.string),

		// ── API config ────────────────────────────────────────────────
		apiConfiguration: types.optional(types.frozen<ProviderSettings>(), {} as ProviderSettings),

		// ── Mistake tracking ──────────────────────────────────────────
		consecutiveMistakeLimit: types.optional(types.integer, 3),
		consecutiveMistakeCount: types.optional(types.integer, 0),
		consecutiveNoToolUseCount: types.optional(types.integer, 0),
		consecutiveNoAssistantMessagesCount: types.optional(types.integer, 0),
		consecutiveMistakeCountForApplyDiff: types.optional(types.frozen<Record<string, number>>(), {}),
		consecutiveMistakeCountForEditFile: types.optional(types.frozen<Record<string, number>>(), {}),
		innerLoopIterationCount: types.optional(types.integer, 0),

		// ── Checkpoint ────────────────────────────────────────────────
		enableCheckpoints: types.optional(types.boolean, true),
		checkpointTimeout: types.optional(types.integer, 60),
		checkpointServiceInitializing: types.optional(types.boolean, false),
		hasCheckpoint: types.optional(types.boolean, false),

		// ── Streaming state ───────────────────────────────────────────
		isStreaming: types.optional(types.boolean, false),
		isWaitingForFirstChunk: types.optional(types.boolean, false),
		currentStreamingContentIndex: types.optional(types.integer, 0),
		currentStreamingDidCheckpoint: types.optional(types.boolean, false),
		didCompleteReadingStream: types.optional(types.boolean, false),
		assistantMessageSavedToHistory: types.optional(types.boolean, false),
		didRejectTool: types.optional(types.boolean, false),
		didAlreadyUseTool: types.optional(types.boolean, false),
		didToolFailInCurrentTurn: types.optional(types.boolean, false),
		streamingToolCallIndices: types.optional(types.frozen<Record<string, number>>(), {}),
		streamingToolCallIndexEntries: types.optional(types.array(types.frozen<[string, number]>()), []),
		presentAssistantMessageLocked: types.optional(types.boolean, false),
		presentAssistantMessageHasPendingUpdates: types.optional(types.boolean, false),
		userMessageContentReady: types.optional(types.boolean, false),

		// ── Loop stack ────────────────────────────────────────────────
		loopStack: types.optional(types.array(types.frozen<LoopStackItem>()), []),

		// ── Misc ──────────────────────────────────────────────────────
		toolUsage: types.optional(types.frozen<ToolUsage>(), {} as ToolUsage),
		didFinishAbortingStream: types.optional(types.boolean, false),
		todoList: types.maybe(types.frozen<TodoItem[]>()),
		goals: types.optional(types.array(types.frozen<Goal>()), []),
		goalsHistory: types.optional(types.array(types.frozen<Goal>()), []),

		// ── Sub-models ──────────────────────────────────────────────
		notifications: types.optional(TaskNotificationsModel, () => ({})),

		// ── Last API request info (per-task) ──────────────────────────
		lastApiReqInfo: types.maybeNull(
			types.frozen<{
				request: unknown
				response: unknown
			}>(),
		),

		// ── Execution state (per-task) ────────────────────────────────
		cursor: types.optional(types.number, 0),
		isProcessing: types.optional(types.boolean, false),
	})
	.volatile(createTaskVolatileState)

// ─── TaskStateBase ───────────────────────────────────────────────────
export const TaskStateBase = types
	.model("Task", {
		taskId: types.identifier,
		instanceId: types.string,
		rootTaskId: types.maybe(types.string),
		parentTaskId: types.maybe(types.string),
		childTaskId: types.maybe(types.string),

		taskNumber: types.integer,
		workspacePath: types.string,

		_taskMode: types.maybe(types.string),
		_taskApiConfigName: types.maybe(types.string),

		abort: types.optional(types.boolean, false),
		turnResetPending: types.optional(types.boolean, false),
		isCompleted: types.optional(types.boolean, false),
		isAsync: types.optional(types.boolean, false),
		isInitialized: types.optional(types.boolean, false),
		isPaused: types.optional(types.boolean, false),
		abandoned: types.optional(types.boolean, false),
		skipPrevResponseIdOnce: types.optional(types.boolean, false),

		abortReason: types.maybe(types.string),
		pendingNewTaskToolCallId: types.maybe(types.string),
		completionResultSummary: types.maybe(types.string),
		initialStatus: types.maybe(types.string),

		consecutiveMistakeLimit: types.integer,
		consecutiveMistakeCount: types.optional(types.integer, 0),
		consecutiveNoToolUseCount: types.optional(types.integer, 0),
		consecutiveNoAssistantMessagesCount: types.optional(types.integer, 0),
		consecutiveMistakeCountForApplyDiff: types.optional(types.frozen<Record<string, number>>(), {}),
		consecutiveMistakeCountForEditFile: types.optional(types.frozen<Record<string, number>>(), {}),
		innerLoopIterationCount: types.optional(types.integer, 0),

		enableCheckpoints: types.boolean,
		checkpointTimeout: types.integer,
		checkpointServiceInitializing: types.optional(types.boolean, false),
		hasCheckpoint: types.optional(types.boolean, false),

		isStreaming: types.optional(types.boolean, false),
		isWaitingForFirstChunk: types.optional(types.boolean, false),
		currentStreamingContentIndex: types.optional(types.integer, 0),
		currentStreamingDidCheckpoint: types.optional(types.boolean, false),
		didCompleteReadingStream: types.optional(types.boolean, false),
		assistantMessageSavedToHistory: types.optional(types.boolean, false),
		didRejectTool: types.optional(types.boolean, false),
		didAlreadyUseTool: types.optional(types.boolean, false),
		didToolFailInCurrentTurn: types.optional(types.boolean, false),
		streamingToolCallIndices: types.optional(types.frozen<Record<string, number>>(), {}),
		streamingToolCallIndexEntries: types.optional(types.array(types.frozen<[string, number]>()), []),
		presentAssistantMessageLocked: types.optional(types.boolean, false),
		presentAssistantMessageHasPendingUpdates: types.optional(types.boolean, false),
		userMessageContentReady: types.optional(types.boolean, false),

		loopStack: types.optional(types.array(types.frozen<LoopStackItem>()), []),

		toolUsage: types.optional(types.frozen<ToolUsage>(), {} as ToolUsage),
		didFinishAbortingStream: types.optional(types.boolean, false),
		todoList: types.maybe(types.frozen<TodoItem[]>()),
		goals: types.optional(types.array(types.frozen<Goal>()), []),
		goalsHistory: types.optional(types.array(types.frozen<Goal>()), []),
		apiConfiguration: types.optional(types.frozen<ProviderSettings>(), {} as ProviderSettings),
	})
	.volatile(() => ({
		api: undefined as import("@api/index").ApiHandler | undefined,
		abortController: undefined as AbortController | undefined,
	}))
