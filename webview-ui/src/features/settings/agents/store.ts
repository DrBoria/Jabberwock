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
	apiConfig: types.optional(ApiConfigStore, () =>
		ApiConfigStore.create({ listApiConfigMeta: [], currentApiConfigId: "" }),
	),
	autoApprove: types.optional(AutoApproveStore, () => AutoApproveStore.create({ autoApproveSettings: {} })),
	indexing: types.optional(IndexingStore, () => IndexingStore.create({ indexingStatus: {} })),
	modeSelector: types.optional(ModeSelectorStore, () => ModeSelectorStore.create({ currentMode: "" })),
})

export type IAgentStateStore = Instance<typeof AgentStateStore>

/** @deprecated Use `getRootStore().agentState` instead. Will be removed after all consumers migrate. */
