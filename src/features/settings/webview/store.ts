import { types, Instance } from "mobx-state-tree"
import type { EventBridge } from "../../../core/webview/EventBridge"
import { getState } from "../../storeSingleton"

export const WebviewModel = types.model("Webview", {})

export type IWebviewModel = Instance<typeof WebviewModel>

// Backward-compatible types and functions
export type WebviewState = object

export function initWebviewState(_provider: EventBridge): void {}

export function getWebviewState(provider: EventBridge): WebviewState {
	return getState(provider).settings.webview as WebviewState
}
