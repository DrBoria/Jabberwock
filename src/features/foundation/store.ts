import { types } from "mobx-state-tree"
import { WindowManagerModel } from "./window-manager/store"
import { AgentStateModel } from "@features/settings/agents/store"
import { initAgentStateState } from "@features/settings/agents/store/index"
import { MstRefModel } from "./mst/store"
import type { EventBridge } from "@features/foundation/webview/EventBridge"
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
