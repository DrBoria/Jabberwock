import { cast } from "mobx-state-tree"
import type { ProviderSettings, ToolUsage } from "@jabberwock/types"
import { buildApiHandler } from "@api/index"
import type { LoopStackItem } from "@features/chat/task/task-store/task-state/task-types"
import { TaskModelWithLifecycle } from "./task-model-actions-lifecycle"

export const TaskModelWithState = TaskModelWithLifecycle.actions((self) => ({
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
	setGlobalStoragePath(path: string) {
		self.globalStoragePath = path
	},
	setTaskModeReady(promise: Promise<void> | undefined) {
		self.taskModeReady = promise
	},
	setLastMessageTs(ts: number) {
		self.lastMessageTs = ts
	},
	setPartialMessage(ts: number, say: string) {
		self._partialMessage = { ts, say }
	},
	clearPartialMessage() {
		self._partialMessage = undefined
	},

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
	setCurrentRequestAbortController(controller: AbortController | undefined) {
		self.currentRequestAbortController = controller
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

	// ── Streaming tool call indices ───────────────────────────────
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
}))
