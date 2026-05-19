import { types, Instance } from "mobx-state-tree"
import type { EventBridge } from "../../../core/webview/EventBridge"
import { getState } from "../../storeSingleton"

export const DebugModel = types.model("Debug", {})

export type IDebugModel = Instance<typeof DebugModel>

// Backward-compatible types and functions
export type DebugState = object

export function initDebugState(_provider: EventBridge): void {}

export function getDebugState(provider: EventBridge): DebugState {
	return getState(provider).settings.debug as DebugState
}
