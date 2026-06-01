import { types, Instance } from "mobx-state-tree"

/**
 * ModeSelectorStore — tracks available modes and current mode selection.
 * Receives snapshots from the extension-side store via MstBridge.
 */
export const ModeSelectorStore = types.model("ModeSelectorStore", {
	currentMode: types.string,
	allModes: types.array(types.frozen<any>()),
	customModes: types.array(types.frozen<any>()),
})

export type IModeSelectorStore = Instance<typeof ModeSelectorStore>
