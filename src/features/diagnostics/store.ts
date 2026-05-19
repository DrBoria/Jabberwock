import { types, Instance } from "mobx-state-tree"
import type { EventBridge } from "../../core/webview/EventBridge"
import { getState } from "../storeSingleton"

export const DiagnosticsModel = types.model("Diagnostics", {})

export type IDiagnosticsModel = Instance<typeof DiagnosticsModel>

// Backward-compatible types and functions
export type DiagnosticsState = object

export function initDiagnosticsState(_provider: EventBridge): void {}

export function getDiagnosticsState(provider: EventBridge): DiagnosticsState {
	return getState(provider).diagnostics as DiagnosticsState
}
