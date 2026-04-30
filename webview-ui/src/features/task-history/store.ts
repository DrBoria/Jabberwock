import { types, Instance } from "mobx-state-tree"

/**
 * TaskHistoryStore — tracks task history updates.
 * Receives snapshots from the extension-side TaskHistoryStore via MstBridge.
 */
export const TaskHistoryStore = types
	.model("TaskHistoryStore", {
		items: types.optional(types.array(types.frozen<any>()), []),
	})
	.actions((self) => ({
		setItems(items: any[]) {
			self.items.replace(items)
		},
		upsertItem(item: any) {
			const idx = self.items.findIndex((h: any) => h.id === item.id)
			if (idx >= 0) {
				self.items[idx] = item
			} else {
				self.items.unshift(item)
			}
		},
	}))

export type ITaskHistoryStore = Instance<typeof TaskHistoryStore>
export const taskHistoryStore = TaskHistoryStore.create({})
