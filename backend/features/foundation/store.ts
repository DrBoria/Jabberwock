import { types } from "mobx-state-tree"
import { WindowManagerModel } from "./window-manager"
import { AgentStateModel, initAgentStateState } from "@features/settings/agents"
import type { EventBridge } from "@features/foundation"
import { initWindowManagerState } from "./window-manager"
import { MstRefModel } from "./mst/store"

export const FoundationModel = types.model("Foundation", {
	windowManager: WindowManagerModel,
	agentState: AgentStateModel,
	mst: MstRefModel,
})

export function initFoundationState(provider: EventBridge): void {
	initWindowManagerState(provider)
	initAgentStateState(provider)
}
