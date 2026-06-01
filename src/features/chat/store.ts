import { types } from "mobx-state-tree"
import { StreamingStoreModel } from "../api/store"
import { CheckpointStoreModel } from "../foundation/time-machine/store"

import { TaskModel } from "./task/store"
import type { ProviderSettings } from "@jabberwock/types"

/**
 * Composite Chat model — aggregates all chat sub-models.
 */

export const ToolCallLogEntry = types.model("ToolCallLogEntry", {
	toolName: types.string,
	args: types.string,
	timestamp: types.number,
	status: types.enumeration(["started", "completed", "error"]),
	result: types.maybe(types.string),
	error: types.maybe(types.string),
})

/**
 * Composite Chat model — aggregates all chat sub-models.
 */

/**
 * Streaming tool call state (replaces NativeToolCallParser static Maps).
 * Managed via MST so MobX reactions can observe changes.
 */
export const StreamingToolCallModel = types.model("StreamingToolCall", {
	id: types.string,
	name: types.string,
	argumentsAccumulator: types.string,
})

export const ChatModel = types
	.model("Chat", {
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
		_started: types.optional(types.boolean, false),

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
		setStarted(val: boolean) {
			self._started = val
		},

		// ── Strings ─────────────────────────────────────────────────────

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
		}): import("./task/store").ITaskModel {
			let task: import("./task/store").ITaskModel
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
export type IChatModel = ReturnType<typeof ChatModel.create>
