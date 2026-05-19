import { types, getSnapshot } from "mobx-state-tree"
import type { EventBridge } from "../../../core/webview/EventBridge"
import { getState } from "../../storeSingleton"

// ─── Backward-compatible interface ─────────────────────────────────────
/** Reserved for notification state */
export type NotificationsState = object

// ─── MST Model (proper typed model, NOT frozen) ────────────────────────
export const NotificationsModel = types.model("Notifications", {})

// ─── Backward-compatible init/get ──────────────────────────────────────

export function initNotificationsState(_provider: EventBridge): void {
	// MST default factory handles initialization
}

export function getNotificationsState(provider: EventBridge): NotificationsState {
	return getState(provider).chat.notifications as NotificationsState
}
