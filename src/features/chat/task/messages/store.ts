import { types } from "mobx-state-tree"
import type { ApiMessage } from "./actions/saveApiConversation"

/**
 * MessagesModel — per-task API conversation history.
 *
 * Owned / composed by TaskModel. Always lives inside a task context
 * because conversation history cannot exist without a task.
 */
export const MessagesModel = types
	.model("Messages", {
		items: types.array(types.frozen<ApiMessage>()),
	})
	.actions((self) => ({
		push(msg: ApiMessage) {
			self.items.push(msg)
		},
		replace(items: ApiMessage[]) {
			self.items.replace(items)
		},
		removeLast() {
			self.items.pop()
		},
	}))

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Named MST model type alias
export interface IMessagesModel extends ReturnType<typeof MessagesModel.create> {}
