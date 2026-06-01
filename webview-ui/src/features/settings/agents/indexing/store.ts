import { types, Instance } from "mobx-state-tree"

/**
 * IndexingStore — tracks code indexing status and search results.
 * Receives snapshots from the extension-side store via MstBridge.
 */
export const IndexingStore = types.model("IndexingStore", {
	indexingStatus: types.frozen<any>(),
	codeSearchResults: types.array(types.frozen<any>()),
})

export type IIndexingStore = Instance<typeof IndexingStore>
