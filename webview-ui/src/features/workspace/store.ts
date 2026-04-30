import { types, Instance } from "mobx-state-tree"

/**
 * WorkspaceStore — tracks workspace state (file paths, opened tabs).
 * Receives snapshots from the extension-side WorkspaceStore via MstBridge.
 */
export const WorkspaceStore = types
	.model("WorkspaceStore", {
		filePaths: types.optional(types.array(types.string), []),
		openedTabs: types.optional(
			types.array(types.frozen<{ label: string; isActive: boolean; path?: string }>()),
			[],
		),
	})
	.actions((self) => ({
		setWorkspace(filePaths: string[], openedTabs: Array<{ label: string; isActive: boolean; path?: string }>) {
			self.filePaths.replace(filePaths)
			self.openedTabs.replace(openedTabs)
		},
	}))

export type IWorkspaceStore = Instance<typeof WorkspaceStore>
export const workspaceStore = WorkspaceStore.create({})
