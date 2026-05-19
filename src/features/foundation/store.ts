import { types } from "mobx-state-tree"
import { WindowManagerModel } from "./window-manager/store"
import { AgentStateModel } from "./agent-state/store"
import { MstRefModel } from "./mst/store"
import { TimerQueueModel } from "./timer-queue/store"
import type { EventBridge } from "../../core/webview/EventBridge"
import { initWindowManagerState } from "./window-manager/store"
import { initTimerQueueState } from "./timer-queue/store"
import { initMstState } from "./mst/store"
import { initAgentStateState } from "./agent-state/store"

export const FoundationModel = types.model("Foundation", {
	windowManager: WindowManagerModel,
	agentState: AgentStateModel,
	mst: MstRefModel,
	timerQueue: TimerQueueModel,
})

export function initFoundationState(provider: EventBridge): void {
	initWindowManagerState(provider)
	initTimerQueueState(provider)
	initMstState(provider)
	initAgentStateState(provider)
}
