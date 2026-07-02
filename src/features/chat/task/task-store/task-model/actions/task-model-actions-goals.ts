import type { Goal, ToolName, TodoItem } from "@jabberwock/types"
import { JabberwockEventName } from "@jabberwock/types"
import { TaskModelWithState } from "./task-model-actions-state"

export const TaskModel = TaskModelWithState.actions((self) => ({
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

	// ── Goals ─────────────────────────────────────────────────────────
	setGoals(goals: Goal[]) {
		self.goals.replace(goals)
	},
	setGoalsHistory(history: Goal[]) {
		self.goalsHistory.replace(history)
	},
	addGoal(text: string, importance?: number): string {
		const id = crypto.randomUUID()
		const goal: Goal = {
			id,
			text,
			ts: Date.now(),
			version: 1,
			importance,
			order: self.goals.length,
		}
		self.goals.push(goal)
		return id
	},
	removeGoal(id: string) {
		const idx = self.goals.findIndex((g) => g.id === id)
		if (idx !== -1) {
			const removed = self.goals[idx]
			if (self.messages.length > 0) {
				self.goalsHistory.push({ ...removed })
			}
			const newGoals = self.goals.filter((g) => g.id !== id)
			self.goals.replace(newGoals.map((g, i) => ({ ...g, order: i })))
		}
	},
	updateGoal(id: string, partial: Partial<Goal>) {
		const idx = self.goals.findIndex((g) => g.id === id)
		if (idx !== -1) {
			const old = self.goals[idx]
			if (self.messages.length > 0) {
				self.goalsHistory.push({ ...old })
			}
			self.goals.replace(
				self.goals.map((g) =>
					g.id === id
						? {
								...old,
								...partial,
								id: old.id,
								version: old.version + 1,
								ts: Date.now(),
							}
						: g,
				),
			)
		}
	},
	reorderGoals(fromIndex: number, toIndex: number) {
		if (fromIndex < 0 || fromIndex >= self.goals.length) return
		if (toIndex < 0 || toIndex >= self.goals.length) return
		const newGoals = [...self.goals]
		const [moved] = newGoals.splice(fromIndex, 1)
		newGoals.splice(toIndex, 0, moved)
		self.goals.replace(newGoals.map((g, i) => ({ ...g, order: i })))
	},

	setIsInitialized(v: boolean) {
		self.isInitialized = v
	},

	setAttemptApiRequest(fn: (retryAttempt: number, opts: { [key: string]: unknown }) => AsyncIterable<unknown>) {
		self.attemptApiRequest = fn
	},
	setAbortController(controller: AbortController) {
		self.abortController = controller
	},

	// ── Cached streaming model ────────────────────────────────────────
	setCachedStreamingModel(model: { id: string; info: { [key: string]: unknown } } | undefined) {
		self.cachedStreamingModel = model
	},

	// ── DidEditFile ───────────────────────────────────────────────────
	setDidEditFile(v: boolean) {
		self.didEditFile = v
	},

	// ── Unique timestamp generation ──────────────────────────────────
	generateUniqueTs(): number {
		const now = Date.now()
		const ts = Math.max(now, self.lastUsedTs + 1)
		self.lastUsedTs = ts
		return ts
	},
}))

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Named MST model type alias
export interface ITaskModel extends ReturnType<typeof TaskModel.create> {}
