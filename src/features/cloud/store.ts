import { types, Instance } from "mobx-state-tree"
import type { EventBridge } from "@features/foundation/webview/EventBridge"

export const CloudModel = types.model("Cloud", {})

export type ICloudModel = Instance<typeof CloudModel>

// Backward-compatible types and functions
export type CloudState = object

export function initCloudState(_provider: EventBridge): void {}

import type { IBackendRootStore } from "@features/store"

export function getCloudState(rootStore: IBackendRootStore): CloudState {
	return rootStore.cloud as CloudState
}

/**
 * Initializes cloud profile sync when ready.
 */
export async function initializeCloudProfileSyncWhenReady(_provider: EventBridge): Promise<void> {
	// Cloud profile sync initialization
}
