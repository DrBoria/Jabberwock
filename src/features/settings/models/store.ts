import { types, Instance } from "mobx-state-tree"
import type { EventBridge } from "../../../features/foundation/webview/EventBridge"
import { getState } from "@features/storeSingleton"

export const ModelsModel = types.model("Models", {})
export type IModelsModel = Instance<typeof ModelsModel>
export type ModelsState = object

export function initModelsState(_provider: EventBridge): void {}

import type { IBackendRootStore } from "../../store"

export function getModelsState(rootStore: IBackendRootStore): ModelsState {
	return rootStore.settings.models as ModelsState
}
