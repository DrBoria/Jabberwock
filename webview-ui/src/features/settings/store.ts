import { types, Instance } from "mobx-state-tree"

/**
 * SettingsStore — holds ad-hoc settings UI state that currently comes via postMessage
 * from the extension. This is separate from the persistent extension state managed
 * by ExtensionStateContext.
 */
export const SettingsStore = types
	.model("SettingsStore", {
		// ── UI state ──
		activeTab: types.optional(types.string, "general"),
		searchQuery: types.optional(types.string, ""),

		// ── Display preferences (synced from extension) ──
		theme: types.maybe(types.frozen<any>()),
		fontSize: types.optional(types.number, 14),
	})
	.actions((self) => ({
		setActiveTab(tab: string) {
			self.activeTab = tab
		},
		setSearchQuery(query: string) {
			self.searchQuery = query
		},
		setTheme(theme: any) {
			self.theme = theme
		},
		setFontSize(size: number) {
			self.fontSize = size
		},
	}))

export type ISettingsStore = Instance<typeof SettingsStore>

export const settingsStore = SettingsStore.create({})
