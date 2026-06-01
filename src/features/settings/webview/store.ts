import { types, Instance } from "mobx-state-tree"
import type { EventBridge } from "../../../features/foundation/webview/EventBridge"
import { getState } from "@features/storeSingleton"

export const WebviewModel = types.model("Webview", {})

export type IWebviewModel = Instance<typeof WebviewModel>

// Backward-compatible types and functions
export type WebviewState = object

export function initWebviewState(_provider: EventBridge): void {}

import type { IBackendRootStore } from "../../store"

export function getWebviewState(rootStore: IBackendRootStore): WebviewState {
	return rootStore.settings.webview as WebviewState
}
