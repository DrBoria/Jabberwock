import { types } from "mobx-state-tree"
import type { Notification } from "@jabberwock/types"

/**
 * NotificationsModel — per-task notification queue (ask/say messages).
 *
 * Owned / composed by TaskModel. Always lives inside a task context
 * because notifications cannot exist without a task.
 */
export const NotificationsModel = types
	.model("Notifications", {
		items: types.array(types.frozen<Notification>()),
	})
	.actions((self) => ({
		addNotification(msg: Notification) {
			self.items.push(msg)
		},
		setNotifications(items: Notification[]) {
			self.items.replace(items)
		},
		updateNotification(index: number, msg: Notification) {
			if (index >= 0 && index < self.items.length) {
				self.items[index] = msg
			}
		},
		clearNotifications() {
			self.items.clear()
		},
	}))

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Named MST model type alias
export interface INotificationsModel extends ReturnType<typeof NotificationsModel.create> {}
