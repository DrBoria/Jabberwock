import { types, Instance } from "mobx-state-tree"
import type { EventBridge } from "../../core/webview/EventBridge"
import { getState } from "../storeSingleton"

export const CloudModel = types.model("Cloud", {})

export type ICloudModel = Instance<typeof CloudModel>

// Backward-compatible types and functions
export type CloudState = object

export function initCloudState(_provider: EventBridge): void {}

export function getCloudState(provider: EventBridge): CloudState {
	return getState(provider).cloud as CloudState
}

/**
 * Initializes cloud profile sync when ready.
 */
export async function initializeCloudProfileSyncWhenReady(provider: EventBridge): Promise<void> {
	// Cloud profile sync initialization
}
