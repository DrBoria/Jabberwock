import type { EventBridge } from "../../core/webview/EventBridge"

export async function initChatState(provider: EventBridge): Promise<void> {
	const { initMessagesListState } = await import("./messages-list/store")
	const { initNotificationsState } = await import("./notifications/store")
	const { initTaskState } = await import("./task/store")
	const { initTextAreaState } = await import("./text-area/store")
	const { initTopicState } = await import("./topic/store")
	const { initAskState } = await import("./ask/store")

	initMessagesListState(provider)
	initNotificationsState(provider)
	initTaskState(provider)
	initTextAreaState(provider)
	initTopicState(provider)
	initAskState(provider)
}
