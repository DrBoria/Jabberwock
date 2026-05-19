import { types, Instance } from "mobx-state-tree"
import type { EventBridge } from "../../../core/webview/EventBridge"
import { getState } from "../../storeSingleton"

export const PromptsModel = types.model("Prompts", {})

export type IPromptsModel = Instance<typeof PromptsModel>

// Backward-compatible types and functions
export type PromptsState = object

export function initPromptsState(_provider: EventBridge): void {}

export function getPromptsState(provider: EventBridge): PromptsState {
	return getState(provider).settings.prompts as PromptsState
}
