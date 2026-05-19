import { types } from "mobx-state-tree"
import { AskModel } from "./ask/store"
import { MessagesListModel } from "./messages-list/store"
import { NotificationsModel } from "./notifications/store"
import { TaskSliceModel } from "./task/store"
import { TextAreaModel } from "./text-area/store"
import { TopicModel } from "./topic/store"

/**
 * Composite Chat model — aggregates all chat sub-models.
 */
export const ChatModel = types.model("Chat", {
	ask: AskModel,
	messagesList: MessagesListModel,
	notifications: NotificationsModel,
	task: TaskSliceModel,
	textArea: TextAreaModel,
	topic: TopicModel,
})
