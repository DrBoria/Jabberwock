import { types, Instance } from "mobx-state-tree"

import type { EventBridge } from "@features/foundation"

import type { IBackendRootStore } from "@features/store"

export const PromptsModel = types.model("Context", {})

export type IPromptsModel = Instance<typeof PromptsModel>

// Backward-compatible types and functions
export type PromptsState = object

export function initPromptsState(_provider: EventBridge): void {}

export function getPromptsState(rootStore: IBackendRootStore): PromptsState {
	return rootStore.settings.prompts as PromptsState
}
