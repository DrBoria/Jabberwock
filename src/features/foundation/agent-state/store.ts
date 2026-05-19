import { types, Instance } from "mobx-state-tree"
import type { EventBridge } from "../../../core/webview/EventBridge"
import { StoreRefType } from "../../mst-custom-types"

// Lazy require to avoid circular dependency: store.ts → foundation/store.ts → agent-state/store.ts → store.ts
function lazyGetState(provider: EventBridge): { foundation: { agentState: unknown } } {
	const storeModule = require("../../store") as { getState: (p: EventBridge) => unknown }
	const rootStore = storeModule.getState(provider)
	return rootStore as { foundation: { agentState: unknown } }
}

export const AgentStateModel = types.model("AgentState", {
	pendingEditOp: StoreRefType,
})

export type IAgentStateModel = Instance<typeof AgentStateModel>

// Backward-compatible types and functions
export interface AgentStateState {
	pendingEditOperation?: { id: string; data: unknown } | null
}

export function initAgentStateState(_provider: EventBridge): void {
	// No-op — state is initialized via MST model defaults
}

export function getAgentStateState(provider: EventBridge): AgentStateState {
	return lazyGetState(provider).foundation.agentState as AgentStateState
}
