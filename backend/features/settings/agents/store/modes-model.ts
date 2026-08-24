import { Instance } from "mobx-state-tree"
import type { EventBridge } from "@features/foundation/webview/EventBridge"
import type { IBackendRootStore } from "@features/store"
import { ModesModel } from "@features/settings/agents/store"

export { ModesModel }
export type IModesModel = Instance<typeof ModesModel>

export type ModesState = IModesModel

export function initModesState(_provider: EventBridge): void {}

export function getModesState(rootStore: IBackendRootStore): ModesState {
	return rootStore.settings.modes as ModesState
}
