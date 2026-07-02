import type { Goal, ToolUsage } from "@jabberwock/types"
import { TaskStateWithActions } from "./actions"

export const TaskStateModel = TaskStateWithActions.actions((self) => ({
	// ── Goals ──────────────────────────────────────────────────
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
			self.goalsHistory.push({ ...removed })
			const newGoals = self.goals.filter((g) => g.id !== id)
			self.goals.replace(newGoals.map((g, i) => ({ ...g, order: i })))
		}
	},
	updateGoal(id: string, partial: Partial<Goal>) {
		const idx = self.goals.findIndex((g) => g.id === id)
		if (idx !== -1) {
			const old = self.goals[idx]
			self.goalsHistory.push({ ...old })
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

	setToolUsage(v: ToolUsage) {
		self.toolUsage = v
	},
}))

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Named MST model type alias
export interface ITaskStateModel extends ReturnType<typeof TaskStateModel.create> {}
