import { Instance } from "mobx-state-tree"
import type { EventBridge } from "@features/foundation/webview/EventBridge"
import type { IBackendRootStore } from "@features/store"
import { AgentStateModel } from "@features/settings/agents/store"

export { AgentStateModel }
export type IAgentStateModel = Instance<typeof AgentStateModel>

// Backward-compatible types and functions
export interface AgentStateState {
	pendingEditOperation?: { id: string; data: unknown } | null
}

export function initAgentStateState(_provider: EventBridge): void {
	// No-op — state is initialized via MST model defaults
}

export function getAgentStateState(rootStore: IBackendRootStore): AgentStateState {
	return rootStore.foundation.agentState as AgentStateState
}
