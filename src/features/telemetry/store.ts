import { types, Instance } from "mobx-state-tree"
import type { EventBridge } from "../../core/webview/EventBridge"
import { getState } from "../storeSingleton"

export const TelemetryModel = types.model("Telemetry", {})

export type ITelemetryModel = Instance<typeof TelemetryModel>

// Backward-compatible types and functions
export type TelemetryState = object

export function initTelemetryState(_provider: EventBridge): void {}

export function getTelemetryState(provider: EventBridge): TelemetryState {
	return getState(provider).telemetry as TelemetryState
}

/**
 * Gets telemetry properties from the provider.
 */
export async function getTelemetryProperties(provider: EventBridge): Promise<Record<string, unknown>> {
	return provider.getTelemetryProperties()
}
