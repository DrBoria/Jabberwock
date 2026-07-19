import type { ProviderSettings } from "@jabberwock/types"

import { TaskModel } from "@features/chat/task/task-store"
import { ChatModelWithViews } from "./chatStore.views"

export const ChatModel = ChatModelWithViews.actions((self) => ({
	setIsRunning(val: boolean) {
		self.isRunning = val
	},
	toolCallStarted(toolName: string, args: string) {
		self.toolCallLog.push({
			toolName,
			args,
			timestamp: Date.now(),
			status: "started",
		})
		// Trim log to prevent unbounded growth
		if (self.toolCallLog.length > 200) {
			self.toolCallLog.splice(0, self.toolCallLog.length - 200)
		}
	},
	toolCallCompleted(toolName: string, result: string) {
		const last = self.toolCallLog[self.toolCallLog.length - 1]
		if (last && last.toolName === toolName && last.status === "started") {
			last.status = "completed"
			last.result = result
		}
	},
	toolCallError(toolName: string, error: string) {
		const last = self.toolCallLog[self.toolCallLog.length - 1]
		if (last && last.toolName === toolName && last.status === "started") {
			last.status = "error"
			last.error = error
		}
	},

	// ── Control flags ───────────────────────────────────────────────
	setAbort(val: boolean) {
		self.abort = val
	},
	setAbortReason(val: string | undefined) {
		self.abortReason = val
	},
	setAbandoned(val: boolean) {
		self.abandoned = val
	},
	setIsCompleted(val: boolean) {
		self.isCompleted = val
	},
	setIsPaused(val: boolean) {
		self.isPaused = val
	},
	setTurnResetPending(val: boolean) {
		self.turnResetPending = val
	},
	setSkipPrevResponseIdOnce(val: boolean) {
		self.skipPrevResponseIdOnce = val
	},

	// ── Streaming tool calls (replaces NativeToolCallParser) ────────
	startToolCall(id: string, name: string) {
		self.streamingToolCalls.set(id, {
			id,
			name,
			argumentsAccumulator: "",
		})
	},
	updateToolCallDelta(id: string, delta: string) {
		const tc = self.streamingToolCalls.get(id)
		if (tc) {
			tc.argumentsAccumulator += delta
		}
	},
	finalizeToolCall(id: string): string | null {
		const tc = self.streamingToolCalls.get(id)
		if (tc) {
			const accum = tc.argumentsAccumulator
			self.streamingToolCalls.delete(id)
			return accum
		}
		return null
	},
	clearAllStreamingToolCalls() {
		self.streamingToolCalls.clear()
	},
	hasActiveStreamingToolCalls(): boolean {
		return self.streamingToolCalls.size > 0
	},

	setCompletionResultSummary(val: string | undefined) {
		self.completionResultSummary = val
	},
	setPendingNewTaskToolCallId(val: string | undefined) {
		self.pendingNewTaskToolCallId = val
	},

	// ── Task management (flattened from TaskManagerModel) ─────────
	createTask(options: {
		taskId: string
		instanceId: string
		rootTaskId: string
		parentTaskId?: string
		childTaskIds: string[]
		taskNumber: number
		workspacePath: string
		apiConfiguration: ProviderSettings
		consecutiveMistakeLimit?: number
	}): import("../task/store").ITaskModel {
		let task: import("../task/store").ITaskModel
		try {
			task = TaskModel.create({
				taskId: options.taskId,
				instanceId: options.instanceId,
				rootTaskId: options.rootTaskId,
				parentTaskId: options.parentTaskId,
				childTaskIds: options.childTaskIds,
				taskNumber: options.taskNumber,
				workspacePath: options.workspacePath,
				abort: false,
				turnResetPending: false,
				isCompleted: false,
				isAsync: false,
				isInitialized: false,
				isPaused: false,
				abandoned: false,
				skipPrevResponseIdOnce: false,
				apiConfiguration: options.apiConfiguration,
				consecutiveMistakeLimit: options.consecutiveMistakeLimit,
			})
		} catch (err) {
			console.error(`[jabberwock] TaskModel.create failed:`, err)
			console.error(`[jabberwock] Stack:`, (err as Error)?.stack)
			throw err
		}
		try {
			self.tasks.put(task)
		} catch (err) {
			console.error(`[jabberwock] self.tasks.put failed:`, err)
			console.error(`[jabberwock] Stack:`, (err as Error)?.stack)
			console.error(`[jabberwock] taskId:`, options.taskId)
			throw err
		}
		self.activeTaskId = task.taskId
		return task
	},
	removeTask(taskId: string): void {
		self.tasks.delete(taskId)
		if (self.activeTaskId === taskId) {
			self.activeTaskId = undefined
		}
	},
	setCurrentTask(taskId: string | undefined): void {
		self.activeTaskId = taskId
	},
	clear(): void {
		self.tasks.clear()
		self.activeTaskId = undefined
	},
}))
