import type { TodoItem } from "@jabberwock/types"
import type { LoopStackItem } from "./task-types"
import { TaskStateBase } from "@features/chat/task/store"

export const TaskStateWithActions = TaskStateBase.actions((self) => ({
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

	// ── streamingToolCallIndices ──
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
}))
