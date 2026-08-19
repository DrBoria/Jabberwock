import { types, Instance } from "mobx-state-tree"
import type { EventBridge } from "@features/foundation/webview/EventBridge"

export const WebviewModel = types.model("Webview", {})

export type IWebviewModel = Instance<typeof WebviewModel>

// Backward-compatible types and functions
export type WebviewState = object

export function initWebviewState(_provider: EventBridge): void {}

import type { IBackendRootStore } from "@features/store"

export function getWebviewState(rootStore: IBackendRootStore): WebviewState {
	return rootStore.settings.webview as WebviewState
}
