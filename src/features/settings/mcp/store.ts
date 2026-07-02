import { types, Instance } from "mobx-state-tree"
import type { EventBridge } from "@features/foundation/webview/EventBridge"
import { getState } from "@features/storeSingleton"

export const McpModel = types.model("Mcp", {})

export type IMcpModel = Instance<typeof McpModel>

// Backward-compatible types and functions
export type McpState = object

export function initMcpState(_provider: EventBridge): void {}

import type { IBackendRootStore } from "@features/store"

export function getMcpState(rootStore: IBackendRootStore): McpState {
	return rootStore.settings.mcp as McpState
}
