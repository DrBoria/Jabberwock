import { types } from "mobx-state-tree"
import type {
	ProviderSettings,
	ToolUsage,
	TodoItem,
	Goal,
	AskResponseValue,
	TokenUsage,
	JabberwockTerminalProcessResultPromise,
} from "@jabberwock/types"
import type { LoopStackItem } from "./task-store/task-state/task-types"
import type { Notification } from "@jabberwock/types"
import type { ITaskModel as _ITaskModel } from "@features/chat/task/task-store"
import type { ApiHandler } from "@api/index"
import type { RepoPerTaskCheckpointService } from "@services/checkpoints"
import type { Anthropic } from "@anthropic-ai/sdk"
import type { AssistantMessageContent } from "@features/chat/task/messages/actions"
import type { ApiMessage } from "@features/chat"
import type { IAutoApprovalHandler } from "@features/settings"
import debounce from "lodash.debounce"
export type { _ITaskModel as ITaskModel }

// ─── Volatile state factory (part of the store — v2/v3: one store per feature) ──
export function createTaskVolatileState() {
	return {
		// Core runtime deps
		api: undefined as ApiHandler | undefined,
		abortController: undefined as AbortController | undefined,
		jabberwockIgnoreController: undefined as string | undefined,

		// Time-machine (checkpoint service)
		checkpointService: undefined as RepoPerTaskCheckpointService | undefined,
		messageManager: undefined as
			| {
					rewindToTimestamp: (ts: number, options: { includeTargetMessage: boolean }) => Promise<void>
			  }
			| undefined,

		// Task runtime state (migrated from "legacy" Task class)
		diffStrategy: undefined as import("@shared/tools").DiffStrategy | undefined,
		globalStoragePath: "",
		lastUsedTs: 0,
		lastApiRequestTime: 0 as number | undefined,
		tokenUsageSnapshot: undefined as TokenUsage | undefined,
		tokenUsageSnapshotAt: undefined as number | undefined,
		toolUsageSnapshot: undefined as ToolUsage | undefined,
		userMessageContent: [] as (
			| Anthropic.TextBlockParam
			| Anthropic.ImageBlockParam
			| Anthropic.ToolResultBlockParam
		)[],
		assistantMessageContent: [] as AssistantMessageContent[],
		messages: [] as Notification[],
		apiConversationHistory: [] as ApiMessage[],
		debouncedEmitTokenUsage: undefined as ReturnType<typeof debounce> | undefined,
		didEditFile: false,
		cachedStreamingModel: undefined as { id: string; info: { [key: string]: unknown } } | undefined,
		lastMessageTs: 0,

		// ── Synchronous partial message tracking ──────────────────────
		_partialMessage: undefined as { ts: number; say: string } | undefined,

		askShownAt: undefined as number | undefined,
		autoApprovalTimeoutRef: undefined as NodeJS.Timeout | undefined,
		cloudSyncedMessageTimestamps: undefined as Set<number> | undefined,
		currentRequestAbortController: undefined as AbortController | undefined,
		terminalProcess: undefined as JabberwockTerminalProcessResultPromise | undefined,

		// ── Promise-based initialization gates ──────────────────────
		taskModeReady: undefined as Promise<void> | undefined,
		taskApiConfigReady: undefined as Promise<void> | undefined,

		// ── Ask response resolver ──────────────────────────────────
		askResolve: undefined as
			| ((value: { response: AskResponseValue; text?: string; images?: string[] }) => void)
			| null
			| undefined,

		// ── Tool repetition detector ───────────────────────────────
		toolRepetitionDetector: undefined as
			| {
					check(block: unknown): {
						allowExecution: boolean
						askUser: { messageKey: string; messageDetail: string }
					}
					reset(): void
			  }
			| undefined,

		// ── Auto-approval handler ───────────────────────────────────
		autoApprovalHandler: undefined as IAutoApprovalHandler | undefined,

		// ── Method stubs (exist on Task class at runtime) ────────────
		getFilesReadByJabberwockSafely: undefined as ((context: string) => Promise<string[] | undefined>) | undefined,
		combineMessages: undefined as ((messages: Notification[]) => Notification[]) | undefined,
		emit: undefined as ((event: string, ...args: unknown[]) => void) | undefined,
		getSavedMessages: undefined as (() => Promise<Notification[]>) | undefined,
		getSavedApiConversationHistory: undefined as (() => Promise<unknown[]>) | undefined,
		saveApiConversationHistory: undefined as (() => Promise<void>) | undefined,
		attemptApiRequest: undefined as
			| ((retryAttempt: number, opts: { [key: string]: unknown }) => AsyncIterable<unknown>)
			| undefined,
	}
}

// ─── NotificationsModel ─────────────────────────────────────────────
export const TaskNotificationsModel = types
	.model("TaskNotifications", {
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
	.model("TaskModel", {
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
	.model("TaskState", {
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
