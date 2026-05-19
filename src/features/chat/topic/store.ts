import { types, getSnapshot } from "mobx-state-tree"
import type { EventBridge } from "../../../core/webview/EventBridge"
import { getState } from "../../storeSingleton"

// ─── Backward-compatible interface ─────────────────────────────────────
/** Reserved for topic state */
export type TopicState = object

// ─── MST Model (proper typed model, NOT frozen) ────────────────────────
export const TopicModel = types.model("Topic", {})

// ─── Backward-compatible init/get ──────────────────────────────────────

export function initTopicState(_provider: EventBridge): void {
	// MST default factory handles initialization
}

export function getTopicState(provider: EventBridge): TopicState {
	return getState(provider).chat.topic as TopicState
}
