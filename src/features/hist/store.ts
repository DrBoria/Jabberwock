import { types, Instance } from "mobx-state-tree"

/**
 * MST model for a single task history item.
 * Uses types.string for the task field since historyItemSchema declares task as z.string().
 */
export const HistoryTaskModel = types.model("History", {
	id: types.string,
	task: types.string,
	ts: types.number,
	tokensIn: types.number,
	tokensOut: types.number,
	cacheWrites: types.optional(types.number, 0),
	cacheReads: types.optional(types.number, 0),
	totalCost: types.number,
	workspace: types.maybe(types.string),
	mode: types.maybe(types.string),
	status: types.maybe(types.string),
	parentTaskId: types.maybe(types.string),
	rootTaskId: types.maybe(types.string),
	childIds: types.optional(types.array(types.string), []),
	number: types.maybe(types.number),
	size: types.maybe(types.number),
	apiConfigName: types.maybe(types.string),
})

export const HistoryModel = types
	.model("Hist", {
		items: types.array(HistoryTaskModel),
		currentTaskId: types.string,
	})
	.actions((self) => ({
		setItems(items: Instance<typeof HistoryTaskModel>[]) {
			self.items.replace(items)
		},
		addItem(item: Instance<typeof HistoryTaskModel>) {
			self.items.push(item)
		},
		updateItem(id: string, update: Partial<Instance<typeof HistoryTaskModel>>) {
			const idx = self.items.findIndex((i) => i.id === id)
			if (idx !== -1) {
				Object.assign(self.items[idx], update)
			}
		},
		removeItem(id: string) {
			self.items.replace(self.items.filter((i) => i.id !== id))
		},
		setCurrentTaskId(id: string) {
			self.currentTaskId = id
		},
	}))

export type IHistoryModel = Instance<typeof HistoryModel>
