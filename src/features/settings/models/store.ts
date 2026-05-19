import { types, Instance } from "mobx-state-tree"
import type { EventBridge } from "../../../core/webview/EventBridge"
import { getState } from "../../storeSingleton"

export const ModelsModel = types.model("Models", {})

export type IModelsModel = Instance<typeof ModelsModel>

// Backward-compatible types and functions
export type ModelsState = object

export function initModelsState(_provider: EventBridge): void {}

export function getModelsState(provider: EventBridge): ModelsState {
	return getState(provider).settings.models as ModelsState
}
