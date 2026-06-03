import type { EventBridge } from "@features/foundation/webview/EventBridge"
// textArea + topic moved to frontend (Phase 4)

export async function initChatState(_provider: EventBridge): Promise<void> {
	// Ask state removed — handled by NotificationsModel reactions
}
