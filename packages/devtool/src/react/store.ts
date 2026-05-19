/**
 * DevToolsStore — holds devtools UI state.
 *
 * Originally from webview-ui/src/features/devtools/store.ts,
 * moved into @jabberwock/devtool so the package is self-contained.
 */

import { types, Instance } from "mobx-state-tree"

export const DevToolsStore = types
	.model("DevToolsStore", {
		isOpen: types.boolean,
		activeTab: types.string,
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

export const devToolsStore = DevToolsStore.create({ isOpen: false, activeTab: "" })
