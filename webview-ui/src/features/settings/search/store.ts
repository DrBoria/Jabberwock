import { types, Instance } from "mobx-state-tree"

import type { SearchableSettingData } from "../components/settings-search/useSettingsSearch"

export const SettingsSearchStoreModel = types
	.model("SettingsSearchStore", {
		index: types.frozen<SearchableSettingData[]>([]),
	})
	.actions((self) => ({
		setIndex(settings: SearchableSettingData[]) {
			self.index = settings
		},
	}))

export type ISettingsSearchStore = Instance<typeof SettingsSearchStoreModel>
