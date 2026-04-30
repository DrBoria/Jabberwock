import { types, Instance } from "mobx-state-tree"

/**
 * DevToolsStore — holds devtools UI state.
 */
export const DevToolsStore = types
	.model("DevToolsStore", {
		isOpen: types.optional(types.boolean, false),
		activeTab: types.optional(types.string, "console"),
	})
	.actions((self) => ({
		toggle() {
			self.isOpen = !self.isOpen
		},
		open() {
			self.isOpen = true
		},
		close() {
			self.isOpen = false
		},
		setActiveTab(tab: string) {
			self.activeTab = tab
		},
	}))

export type IDevToolsStore = Instance<typeof DevToolsStore>

export const devToolsStore = DevToolsStore.create({})
