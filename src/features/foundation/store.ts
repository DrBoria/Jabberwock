import { types } from "mobx-state-tree"
import { WindowManagerModel } from "./window-manager/store"
import { AgentStateModel, initAgentStateState } from "../settings/agents/store"
import { MstRefModel } from "./mst/store"
import type { EventBridge } from "../../features/foundation/webview/EventBridge"
import { initWindowManagerState } from "./window-manager/store"
import { initMstState } from "./mst/store"

export const FoundationModel = types.model("Foundation", {
	windowManager: WindowManagerModel,
	agentState: AgentStateModel,
	mst: MstRefModel,
})

export function initFoundationState(provider: EventBridge): void {
	initWindowManagerState(provider)
	initMstState(provider)
	initAgentStateState(provider)
}
