import { types, Instance } from "mobx-state-tree"
import type { EventBridge } from "../../../core/webview/EventBridge"
import { getState } from "../../storeSingleton"

export const ModesModel = types.model("Modes", {})

export type IModesModel = Instance<typeof ModesModel>

// Backward-compatible types and functions
export type ModesState = object

export function initModesState(_provider: EventBridge): void {}

export function getModesState(provider: EventBridge): ModesState {
	return getState(provider).settings.modes as ModesState
}
