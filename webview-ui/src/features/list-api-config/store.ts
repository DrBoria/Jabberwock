import { types, Instance } from "mobx-state-tree"

/**
 * ListApiConfigStore — tracks API configuration list.
 * Receives snapshots from the extension-side ListApiConfigStore via MstBridge.
 */
export const ListApiConfigStore = types
	.model("ListApiConfigStore", {
		listApiConfig: types.optional(types.array(types.frozen<any>()), []),
	})
	.actions((self) => ({
		setListApiConfig(configs: any[]) {
			self.listApiConfig.replace(configs)
		},
	}))

export type IListApiConfigStore = Instance<typeof ListApiConfigStore>
export const listApiConfigStore = ListApiConfigStore.create({})
