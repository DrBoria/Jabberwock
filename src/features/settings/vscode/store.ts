import { types, Instance } from "mobx-state-tree"
import type { EventBridge } from "../../../core/webview/EventBridge"
import { getState } from "../../storeSingleton"

export const VscodeModel = types.model("Vscode", {})

export type IVscodeModel = Instance<typeof VscodeModel>

// Backward-compatible types and functions
export type VscodeState = object

export function initVscodeState(_provider: EventBridge): void {}

export function getVscodeState(provider: EventBridge): VscodeState {
	return getState(provider).settings.vscode as VscodeState
}
