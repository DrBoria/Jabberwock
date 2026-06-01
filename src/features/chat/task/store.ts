import { types, getRoot, cast } from "mobx-state-tree"
import { JabberwockEventName } from "@jabberwock/types"
import type { ProviderSettings, ToolName, ToolUsage, TodoItem, TokenUsage } from "@jabberwock/types"
import type { Notification } from "@jabberwock/types"
import type { ApiMessage } from "./messages/actions/saveApiConversation"
import { NotificationsModel } from "./notifications/store"
import type { ApiHandler } from "../../../api/index"
import type { RepoPerTaskCheckpointService } from "../../../services/checkpoints"
import type { DiffViewProvider } from "../../../integrations/editor/DiffViewProvider"
import type { VirtualWorkspace } from "../../../features/foundation/time-machine/VirtualWorkspace"

import { buildApiHandler } from "../../../api/index"
import type { Anthropic } from "@anthropic-ai/sdk"
import type { EventBridge } from "../../foundation/webview/EventBridge"
import type { JabberwockTerminalProcessResultPromise } from "../../../integrations/terminal/types"
import type { AssistantMessageContent } from "./messages/actions"
import debounce from "lodash.debounce"

// ─── Task Status ────────────────────────────────────────────────────────

export type TaskStatus = "active" | "completed" | "aborted"

// ─── LoopStackItem (used by TaskStateModel.loopStack) ────────────────────

import type { AskResponseValue } from "@jabberwock/types"
import type { IAutoApprovalHandler } from "../../settings/store"

export interface LoopStackItem {
	userContent: Anthropic.Messages.ContentBlockParam[]
	includeFileDetails: boolean
	retryAttempt: number
	userMessageWasRemoved?: boolean
}

// ─── OLD TaskStateModel (COMPATIBILITY — used by legacy utils) ──────────
// WARNING: This model exists ONLY as a backward-compatibility layer for
// legacy utility functions (messaging.ts, mainLoop.ts, etc.).
// Do NOT use this model in new code.
//
// The new architecture uses TaskModel (LEAN) + domain-specific stores
// (AskStoreModel, StreamingStoreModel, etc.).
//
// This model will be deleted when all legacy behavior is fully migrated.

export const TaskStateModel = types
	.model("TaskState", {
		// ── Identity ──────────────────────────────────────────────────────
		taskId: types.identifier,
		instanceId: types.string,
		rootTaskId: types.maybe(types.string),
		parentTaskId: types.maybe(types.string),
		childTaskId: types.maybe(types.string),

		// ── Instance metadata ─────────────────────────────────────────────
		taskNumber: types.integer,
		workspacePath: types.string,

		// ── Mode / API config ─────────────────────────────────────────────
		_taskMode: types.maybe(types.string),
		_taskApiConfigName: types.maybe(types.string),

		// ── Control flags (all optional with defaults) ────────────────────
		abort: types.optional(types.boolean, false),
		turnResetPending: types.optional(types.boolean, false),
		isCompleted: types.optional(types.boolean, false),
		isAsync: types.optional(types.boolean, false),
		isInitialized: types.optional(types.boolean, false),
		isPaused: types.optional(types.boolean, false),
		abandoned: types.optional(types.boolean, false),
		skipPrevResponseIdOnce: types.optional(types.boolean, false),
		_started: types.optional(types.boolean, false),

		// ── Edge case strings ─────────────────────────────────────────────
		abortReason: types.maybe(types.string),
		pendingNewTaskToolCallId: types.maybe(types.string),
		completionResultSummary: types.maybe(types.string),
		initialStatus: types.maybe(types.string),

		// ── Mistake tracking (all optional with defaults) ─────────────────
		consecutiveMistakeLimit: types.integer,
		consecutiveMistakeCount: types.optional(types.integer, 0),
		consecutiveNoToolUseCount: types.optional(types.integer, 0),
		consecutiveNoAssistantMessagesCount: types.optional(types.integer, 0),
		consecutiveMistakeCountForApplyDiff: types.optional(types.frozen<Record<string, number>>(), {}),
		consecutiveMistakeCountForEditFile: types.optional(types.frozen<Record<string, number>>(), {}),
		innerLoopIterationCount: types.optional(types.integer, 0),

		// ── Checkpoint ────────────────────────────────────────────────────
		enableCheckpoints: types.boolean,
		checkpointTimeout: types.integer,
		checkpointServiceInitializing: types.optional(types.boolean, false),
		hasCheckpoint: types.optional(types.boolean, false),

		// ── Streaming state (all optional with defaults) ──────────────────
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

		// ── Loop stack (array of frozen items) ────────────────────────────
		loopStack: types.optional(types.array(types.frozen<LoopStackItem>()), []),

		// ── Misc (all optional with defaults) ─────────────────────────────
		toolUsage: types.optional(types.frozen<ToolUsage>(), {} as ToolUsage),
		didFinishAbortingStream: types.optional(types.boolean, false),
		todoList: types.maybe(types.frozen<TodoItem[]>()),
		apiConfiguration: types.optional(types.frozen<ProviderSettings>(), {} as ProviderSettings),
	})
	.volatile(() => ({
		api: undefined as ApiHandler | undefined,
		abortController: undefined as AbortController | undefined,
	}))
	.actions((self) => ({
		// ── Streaming state setters ─────────────────────────────────────
		setIsStreaming(v: boolean) {
			self.isStreaming = v
		},
		setIsWaitingForFirstChunk(v: boolean) {
			self.isWaitingForFirstChunk = v
		},
		setCurrentStreamingContentIndex(v: number) {
			self.currentStreamingContentIndex = v
		},
		setCurrentStreamingDidCheckpoint(v: boolean) {
			self.currentStreamingDidCheckpoint = v
		},
		setDidCompleteReadingStream(v: boolean) {
			self.didCompleteReadingStream = v
		},
		setAssistantMessageSavedToHistory(v: boolean) {
			self.assistantMessageSavedToHistory = v
		},
		setDidRejectTool(v: boolean) {
			self.didRejectTool = v
		},
		setDidAlreadyUseTool(v: boolean) {
			self.didAlreadyUseTool = v
		},
		setDidToolFailInCurrentTurn(v: boolean) {
			self.didToolFailInCurrentTurn = v
		},
		setUserMessageContentReady(v: boolean) {
			self.userMessageContentReady = v
		},
		setPresentAssistantMessageLocked(v: boolean) {
			self.presentAssistantMessageLocked = v
		},
		setPresentAssistantMessageHasPendingUpdates(v: boolean) {
			self.presentAssistantMessageHasPendingUpdates = v
		},
		setDidFinishAbortingStream(v: boolean) {
			self.didFinishAbortingStream = v
		},

		// ── streamingToolCallIndices (frozen Record — replace entire value) ──
		setStreamingToolCallIndex(id: string, index: number) {
			self.streamingToolCallIndices = {
				...self.streamingToolCallIndices,
				[id]: index,
			}
		},
		deleteStreamingToolCallIndex(id: string) {
			const copy = { ...self.streamingToolCallIndices }
			delete copy[id]
			self.streamingToolCallIndices = copy
		},
		resetStreamingToolCallIndices() {
			self.streamingToolCallIndices = {}
		},

		// ── Loop stack ──────────────────────────────────────────────────
		pushToLoopStack(item: LoopStackItem) {
			self.loopStack.push(item)
		},
		popFromLoopStack(): LoopStackItem | undefined {
			return self.loopStack.pop()
		},
		replaceLoopStack(items: LoopStackItem[]) {
			self.loopStack.replace(items)
		},

		// ── Control flags ───────────────────────────────────────────────
		setAbort(v: boolean) {
			self.abort = v
		},
		setAbortReason(v: string | undefined) {
			self.abortReason = v
		},
		setAbandoned(v: boolean) {
			self.abandoned = v
		},
		setIsCompleted(v: boolean) {
			self.isCompleted = v
		},
		setIsPaused(v: boolean) {
			self.isPaused = v
		},
		setTurnResetPending(v: boolean) {
			self.turnResetPending = v
		},
		setSkipPrevResponseIdOnce(v: boolean) {
			self.skipPrevResponseIdOnce = v
		},

		// ── Mistake tracking ────────────────────────────────────────────
		setConsecutiveMistakeCount(v: number) {
			self.consecutiveMistakeCount = v
		},
		setConsecutiveNoToolUseCount(v: number) {
			self.consecutiveNoToolUseCount = v
		},
		setConsecutiveNoAssistantMessagesCount(v: number) {
			self.consecutiveNoAssistantMessagesCount = v
		},
		setInnerLoopIterationCount(v: number) {
			self.innerLoopIterationCount = v
		},

		// ── Checkpoint state ────────────────────────────────────────────
		setEnableCheckpoints(v: boolean) {
			self.enableCheckpoints = v
		},
		setCheckpointServiceInitializing(v: boolean) {
			self.checkpointServiceInitializing = v
		},

		// ── Initialization ──────────────────────────────────────────────
		setIsInitialized(v: boolean) {
			self.isInitialized = v
		},
		setStarted(v: boolean) {
			self._started = v
		},
		setTaskMode(v: string | undefined) {
			self._taskMode = v
		},
		setTaskApiConfigName(v: string | undefined) {
			self._taskApiConfigName = v
		},

		// ── Frozen object replacements ──────────────────────────────────
		setConsecutiveMistakeCountForEditFile(v: Record<string, number>) {
			self.consecutiveMistakeCountForEditFile = v
		},
		setCompletionResultSummary(v: string | undefined) {
			self.completionResultSummary = v
		},
		setConsecutiveMistakeCountForApplyDiff(v: Record<string, number>) {
			self.consecutiveMistakeCountForApplyDiff = v
		},
		deleteConsecutiveMistakeCountForApplyDiffKey(key: string) {
			const copy = { ...self.consecutiveMistakeCountForApplyDiff }
			delete copy[key]
			self.consecutiveMistakeCountForApplyDiff = copy
		},

		setTodoList(v: TodoItem[] | undefined) {
			self.todoList = v
		},

		setToolUsage(v: ToolUsage) {
			self.toolUsage = v
		},
	}))

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Named MST model type alias
export interface ITaskStateModel extends ReturnType<typeof TaskStateModel.create> {}

// ─── NEW LEAN TaskModel (identity + control + runtime state) ──────────
// NOTE: This model was originally "lean" but has been expanded with all
// TaskStateModel properties and Task class runtime state for backward
// compatibility during the Phase 5 migration.

export const TaskModel = types
	.model("Task", {
		// ── Identity (required, no optional/maybe) ────────────────────
		taskId: types.identifier,
		instanceId: types.string,
		rootTaskId: types.maybe(types.string),
		childTaskIds: types.array(types.string),

		// ── Edge cases (true maybes) ──────────────────────────────────
		parentTaskId: types.maybe(types.string), // root task has no parent
		childTaskId: types.maybe(types.string), // leaf task has no child

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
		_started: types.optional(types.boolean, false),

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

		// ── Sub-models ──────────────────────────────────────────────
		notifications: types.optional(NotificationsModel, () => ({})),

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
	.volatile(() => ({
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

		// Task runtime state (migrated from legacy Task class)
		diffStrategy: undefined as import("../../../shared/tools").DiffStrategy | undefined,
		providerRef: undefined as WeakRef<EventBridge> | undefined,
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
		askShownAt: undefined as number | undefined,
		autoApprovalTimeoutRef: undefined as NodeJS.Timeout | undefined,
		cloudSyncedMessageTimestamps: undefined as Set<number> | undefined,
		currentRequestAbortController: undefined as AbortController | undefined,
		terminalProcess: undefined as JabberwockTerminalProcessResultPromise | undefined,

		// ── Promise-based initialization gates (from Task class) ─────
		taskModeReady: undefined as Promise<void> | undefined,
		taskApiConfigReady: undefined as Promise<void> | undefined,

		// ── Ask response resolver (from Task class) ──────────────────
		askResolve: undefined as
			| ((value: { response: AskResponseValue; text?: string; images?: string[] }) => void)
			| null
			| undefined,

		// ── Tool repetition detector (from Task class) ───────────────
		toolRepetitionDetector: undefined as
			| {
					check(block: unknown): {
						allowExecution: boolean
						askUser: { messageKey: string; messageDetail: string }
					}
					reset(): void
			  }
			| undefined,

		// ── Auto-approval handler (MST model, replaces Task class) ───
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
	}))
	.views((self) => ({
		// ── Computed state ────────────────────────────────────────────────
		get taskStatus(): TaskStatus {
			if (self.abort) return "aborted"
			if (self.isCompleted) return "completed"
			return "active"
		},
		get taskMode(): string {
			if (self._taskMode === undefined) {
				throw new Error(
					"Task mode accessed before initialization. Use getTaskMode() or wait for taskModeReady.",
				)
			}
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

		// ── Backward compat: _state returns self for old code accessing task._state.X
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
	.actions((self) => ({
		// ── Lifecycle ──────────────────────────────────────────────────────
		afterCreate() {
			self.api = buildApiHandler(self.apiConfiguration)
		},
		beforeDestroy() {
			;(self.api as { abort?: () => void } | undefined)?.abort?.()
			self.abortController?.abort()
		},

		// ── Core state actions ────────────────────────────────────────────
		cancelCurrentRequest(): void {
			self.abort = true
			self.abortController?.abort()
		},

		// ── Task interface methods ─────────────────────────────────────────
		submitUserMessage(text: string, images?: string[], _mode?: string, _providerProfile?: string): Promise<void> {
			const trimmedText = text?.trim()
			if (!trimmedText && (!images || images.length === 0)) {
				return Promise.resolve()
			}
			if (self.askResolve) {
				self.askResolve({
					response: "messageResponse" as AskResponseValue,
					text: trimmedText || "",
					images,
				})
				self.askResolve = null
			}
			return Promise.resolve()
		},
		abortTask(): void {
			self.abort = true
			self.abortController?.abort()
		},
		updateApiConfiguration(profile: unknown): void {
			const config = profile as ProviderSettings
			self.apiConfiguration = config
			self.api = buildApiHandler(config)
		},
		getTaskMode(): Promise<string> {
			return Promise.resolve(self.taskMode)
		},
		handleTerminalOperation(operation: unknown): void {
			const tp = self.terminalProcess
			if (operation === "continue") {
				tp?.continue()
			} else if (operation === "abort") {
				tp?.abort()
			}
		},

		setAbort(value: boolean) {
			self.abort = value
		},
		setTurnResetPending(value: boolean) {
			self.turnResetPending = value
		},
		setIsCompleted(value: boolean) {
			self.isCompleted = value
		},
		setIsPaused(value: boolean) {
			self.isPaused = value
		},
		setAbandoned(value: boolean) {
			self.abandoned = value
		},
		setSkipPrevResponseIdOnce(value: boolean) {
			self.skipPrevResponseIdOnce = value
		},
		setAbortReason(reason: string | undefined) {
			self.abortReason = reason
		},
		setPendingNewTaskToolCallId(id: string | undefined) {
			self.pendingNewTaskToolCallId = id
		},
		setCompletionResultSummary(summary: string | undefined) {
			self.completionResultSummary = summary
		},
		setInitialStatus(status: string | undefined) {
			self.initialStatus = status
		},
		setTaskMode(mode: string) {
			self._taskMode = mode
		},
		setTaskApiConfigName(name: string | undefined) {
			self._taskApiConfigName = name
		},
		setApiConfiguration(config: ProviderSettings) {
			self.apiConfiguration = config
			self.api = buildApiHandler(config)
		},
		addChildTaskId(childId: string) {
			if (!self.childTaskIds.includes(childId)) {
				self.childTaskIds.push(childId)
			}
		},
		removeChildTaskId(childId: string) {
			self.childTaskIds = cast(self.childTaskIds.filter((id) => id !== childId))
		},

		setLastApiReqInfo(info: { request: unknown; response: unknown } | null) {
			self.lastApiReqInfo = info
		},

		setLastApiRequestTime(t: number | undefined) {
			self.lastApiRequestTime = t
		},

		// ── Execution state actions (per-task) ────────────────────────
		incrementCursor() {
			self.cursor++
		},
		setIsProcessing(value: boolean) {
			self.isProcessing = value
		},

		// ── Streaming state actions ───────────────────────────────────────
		setIsStreaming(v: boolean) {
			self.isStreaming = v
		},
		setIsWaitingForFirstChunk(v: boolean) {
			self.isWaitingForFirstChunk = v
		},
		setCurrentStreamingContentIndex(v: number) {
			self.currentStreamingContentIndex = v
		},
		setCurrentStreamingDidCheckpoint(v: boolean) {
			self.currentStreamingDidCheckpoint = v
		},
		setDidCompleteReadingStream(v: boolean) {
			self.didCompleteReadingStream = v
		},
		setAssistantMessageSavedToHistory(v: boolean) {
			self.assistantMessageSavedToHistory = v
		},
		setDidRejectTool(v: boolean) {
			self.didRejectTool = v
		},
		setDidAlreadyUseTool(v: boolean) {
			self.didAlreadyUseTool = v
		},
		setDidToolFailInCurrentTurn(v: boolean) {
			self.didToolFailInCurrentTurn = v
		},
		setUserMessageContentReady(v: boolean) {
			self.userMessageContentReady = v
		},
		setPresentAssistantMessageLocked(v: boolean) {
			self.presentAssistantMessageLocked = v
		},
		setPresentAssistantMessageHasPendingUpdates(v: boolean) {
			self.presentAssistantMessageHasPendingUpdates = v
		},
		setDidFinishAbortingStream(v: boolean) {
			self.didFinishAbortingStream = v
		},

		// ── Streaming tool call indices (frozen Record — replace entire value) ──
		setStreamingToolCallIndex(id: string, index: number) {
			self.streamingToolCallIndices = {
				...self.streamingToolCallIndices,
				[id]: index,
			}
		},
		deleteStreamingToolCallIndex(id: string) {
			const copy = { ...self.streamingToolCallIndices }
			delete copy[id]
			self.streamingToolCallIndices = copy
		},
		resetStreamingToolCallIndices() {
			self.streamingToolCallIndices = {}
		},

		// ── Mistake tracking ──────────────────────────────────────────────
		setConsecutiveMistakeCount(v: number) {
			self.consecutiveMistakeCount = v
		},
		setConsecutiveNoToolUseCount(v: number) {
			self.consecutiveNoToolUseCount = v
		},
		setConsecutiveNoAssistantMessagesCount(v: number) {
			self.consecutiveNoAssistantMessagesCount = v
		},
		setInnerLoopIterationCount(v: number) {
			self.innerLoopIterationCount = v
		},
		setConsecutiveMistakeCountForEditFile(v: Record<string, number>) {
			self.consecutiveMistakeCountForEditFile = v
		},
		setConsecutiveMistakeCountForApplyDiff(v: Record<string, number>) {
			self.consecutiveMistakeCountForApplyDiff = v
		},
		deleteConsecutiveMistakeCountForApplyDiffKey(key: string) {
			const copy = { ...self.consecutiveMistakeCountForApplyDiff }
			delete copy[key]
			self.consecutiveMistakeCountForApplyDiff = copy
		},

		// ── Checkpoint ────────────────────────────────────────────────────
		setEnableCheckpoints(v: boolean) {
			self.enableCheckpoints = v
		},
		setCheckpointServiceInitializing(v: boolean) {
			self.checkpointServiceInitializing = v
		},

		// ── Loop stack ────────────────────────────────────────────────────
		pushToLoopStack(item: LoopStackItem) {
			self.loopStack.push(item)
		},
		popFromLoopStack(): LoopStackItem | undefined {
			return self.loopStack.pop()
		},
		replaceLoopStack(items: LoopStackItem[]) {
			self.loopStack.replace(items)
		},

		// ── Misc setters ──────────────────────────────────────────────────
		setToolUsage(v: ToolUsage) {
			self.toolUsage = v
		},

		// ── Tool usage metrics ─────────────────────────────────────────────
		recordToolUsage(toolName: ToolName) {
			const current = self.toolUsage
			const entry = current[toolName]
			self.toolUsage = {
				...current,
				[toolName]: {
					attempts: (entry?.attempts ?? 0) + 1,
					failures: entry?.failures ?? 0,
				},
			}
		},
		recordToolError(toolName: ToolName, error?: string) {
			const current = self.toolUsage
			const entry = current[toolName]
			self.toolUsage = {
				...current,
				[toolName]: {
					attempts: entry?.attempts ?? 0,
					failures: (entry?.failures ?? 0) + 1,
				},
			}
			if (error) {
				self.emit?.(JabberwockEventName.TaskToolFailed, self.taskId, toolName, error)
			}
		},

		setTodoList(v: TodoItem[] | undefined) {
			self.todoList = v
		},
		setIsInitialized(v: boolean) {
			self.isInitialized = v
		},
		setStarted(v: boolean) {
			self._started = v
		},
		setAbortController(controller: AbortController) {
			self.abortController = controller
		},

		// ── Token usage ───────────────────────────────────────────────────
		setTokenUsageSnapshot(tokenUsage: TokenUsage) {
			self.tokenUsageSnapshot = tokenUsage
		},

		// ── DidEditFile ───────────────────────────────────────────────────
		setDidEditFile(v: boolean) {
			self.didEditFile = v
		},

		// ── Unique timestamp generation (replaces Task.generateUniqueTs) ──
		generateUniqueTs(): number {
			const now = Date.now()
			const ts = Math.max(now, self.lastUsedTs + 1)
			self.lastUsedTs = ts
			return ts
		},
	}))

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Named MST model type alias
export interface ITaskModel extends ReturnType<typeof TaskModel.create> {}

// TaskManagerModel folded into ChatModel (Phase 4b Step 4)
