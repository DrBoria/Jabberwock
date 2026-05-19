import { types, Instance } from "mobx-state-tree"
import type { EventBridge } from "../../../core/webview/EventBridge"
import { getState } from "../../storeSingleton"

export const McpModel = types.model("Mcp", {})

export type IMcpModel = Instance<typeof McpModel>

// Backward-compatible types and functions
export type McpState = object

export function initMcpState(_provider: EventBridge): void {}

export function getMcpState(provider: EventBridge): McpState {
	return getState(provider).settings.mcp as McpState
}
