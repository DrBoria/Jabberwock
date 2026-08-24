import { types, Instance } from "mobx-state-tree"

/**
 * ApiConfigStore — tracks API configuration list and current selection.
 * Receives snapshots from the extension-side store via MstBridge.
 */
const ApiConfigStore = types.model("ApiConfigStore", {
	listApiConfigMeta: types.array(types.frozen<Record<string, unknown>>()),
	currentApiConfigId: types.string,
})

/**
 * AutoApproveStore — tracks auto-approval settings.
 * Receives snapshots from the extension-side store via MstBridge.
 */
const AutoApproveStore = types.model("AutoApproveStore", {
	autoApproveSettings: types.frozen<Record<string, boolean>>(),
	isAutoApprovalEnabled: false,
})

/**
 * IndexingStore — tracks code indexing status and search results.
 * Receives snapshots from the extension-side store via MstBridge.
 */
const IndexingStore = types.model("IndexingStore", {
	indexingStatus: types.frozen<Record<string, unknown>>(),
	codeSearchResults: types.array(types.frozen<Record<string, unknown>>()),
})

/**
 * ModeSelectorStore — tracks available modes and current mode selection.
 * Receives snapshots from the extension-side store via MstBridge.
 */
const ModeSelectorStore = types
	.model("ModeSelectorStore", {
		currentMode: types.string,
		allModes: types.array(types.frozen<Record<string, unknown>>()),
		customModes: types.array(types.frozen<Record<string, unknown>>()),
	})
	.actions((self) => ({
		setCurrentMode(mode: string) {
			self.currentMode = mode
		},
		setAllModes(modes: Record<string, unknown>[]) {
			self.allModes.replace(modes)
		},
		setCustomModes(modes: Record<string, unknown>[]) {
			self.customModes.replace(modes)
		},
	}))

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
