import { types } from "mobx-state-tree"
import type { ProviderSettings } from "@jabberwock/types"

import { StreamingStoreModel } from "@features/api"
import { CheckpointStoreModel } from "@features/foundation/time-machine"
import { TaskModel } from "./task/task-store"
import { ToolCallLogEntry } from "./toolcalllogentry/store"
import { StreamingToolCallModel } from "./streamingtoolcall/store"

export const ChatModelDefinition = types
	.model("Chat", {
		// Domain-specific feature stores (per-task entries)
		streaming: types.optional(StreamingStoreModel, () => ({ entries: {} })),
		checkpoint: types.optional(CheckpointStoreModel, () => ({ entries: {} })),

		// Task management — flattened from "former" TaskManagerModel
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
	.views((self) => ({
		get activeTask(): import("./task/store").ITaskModel | undefined {
			return self.activeTaskId ? self.tasks.get(self.activeTaskId) : undefined
		},
		get hasActiveTask(): boolean {
			return self.activeTaskId !== undefined && self.tasks.has(self.activeTaskId)
		},
		get taskCount(): number {
			return self.tasks.size
		},
		getTask(taskId: string): import("./task/store").ITaskModel | undefined {
			return self.tasks.get(taskId)
		},
		hasTask(taskId: string): boolean {
			return self.tasks.has(taskId)
		},
	}))
	.actions((self) => ({
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

		// ── Task management (flattened from "TaskManagerModel") ─────────
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
		}): import("./task/store").ITaskModel {
			try {
				self.tasks.put({
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
				console.error(`[jabberwock] self.tasks.put failed:`, err)
				console.error(`[jabberwock] Stack:`, (err as Error)?.stack)
				console.error(`[jabberwock] taskId:`, options.taskId)
				throw err
			}
			const task = self.tasks.get(options.taskId)
			if (!task) {
				throw new Error(`[jabberwock] Task not found after put: ${options.taskId}`)
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

export const ChatModel = ChatModelDefinition
