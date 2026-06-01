import { types, Instance } from "mobx-state-tree"

/**
 * ApiConfigStore — tracks API configuration list and current selection.
 * Receives snapshots from the extension-side store via MstBridge.
 */
export const ApiConfigStore = types.model("ApiConfigStore", {
	listApiConfigMeta: types.array(types.frozen<any>()),
	currentApiConfigId: types.string,
})

export type IApiConfigStore = Instance<typeof ApiConfigStore>
