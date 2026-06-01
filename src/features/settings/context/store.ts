import { types, Instance } from "mobx-state-tree"
import type { EventBridge } from "../../../features/foundation/webview/EventBridge"
import { getState } from "@features/storeSingleton"

export const PromptsModel = types.model("Prompts", {})

export type IPromptsModel = Instance<typeof PromptsModel>

// Backward-compatible types and functions
export type PromptsState = object

export function initPromptsState(_provider: EventBridge): void {}

import type { IBackendRootStore } from "../../store"

export function getPromptsState(rootStore: IBackendRootStore): PromptsState {
	return rootStore.settings.prompts as PromptsState
}
