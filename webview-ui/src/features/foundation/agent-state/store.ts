import { types, Instance } from "mobx-state-tree"
import { ApiConfigStore } from "./api-config/store"
import { AutoApproveStore } from "./auto-approve/store"
import { IndexingStore } from "./indexing/store"
import { ModeSelectorStore } from "./mode-selector/store"

/**
 * AgentStateStore — composite store for all agent-state sub-stores.
 * This is the single entry point registered with MstBridge.
 */
export const AgentStateStore = types.model("AgentStateStore", {
	apiConfig: types.optional(ApiConfigStore, () => ApiConfigStore.create({})),
	autoApprove: types.optional(AutoApproveStore, () => AutoApproveStore.create({})),
	indexing: types.optional(IndexingStore, () => IndexingStore.create({})),
	modeSelector: types.optional(ModeSelectorStore, () => ModeSelectorStore.create({})),
})

export type IAgentStateStore = Instance<typeof AgentStateStore>

/** Singleton instance of the AgentStateStore. */
export const agentStateStore = AgentStateStore.create({})
