import { types, getSnapshot } from "mobx-state-tree"
import type { EventBridge } from "../../../core/webview/EventBridge"
import { getState } from "../../storeSingleton"

// ─── Backward-compatible interface ─────────────────────────────────────
/** Reserved for text area input state */
export type TextAreaState = object

// ─── MST Model (proper typed model, NOT frozen) ────────────────────────
export const TextAreaModel = types.model("TextArea", {})

// ─── Backward-compatible init/get ──────────────────────────────────────

export function initTextAreaState(_provider: EventBridge): void {
	// MST default factory handles initialization
}

export function getTextAreaState(provider: EventBridge): TextAreaState {
	return getState(provider).chat.textArea as TextAreaState
}
