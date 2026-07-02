import { types } from "mobx-state-tree"
import type { EventBridge } from "@features/foundation/webview/EventBridge"
import type { IBackendRootStore } from "@features/store"
import { ApiConfigModel } from "@features/settings/models/api-config-store"
import { FilesModel } from "@features/foundation/time-machine/store"
import { McpModel } from "@features/settings/mcp/store"
import { ModelsModel } from "@features/settings/models/store"
import { ModesModel } from "@features/settings/agents/store"
import { PromptsModel } from "@features/settings/context/store"
import { SkillsModel } from "@features/settings/skills/store"
import { WebviewModel } from "@features/settings/webview/store"

export const SettingsModel = types
	.model("Settings", {
		apiConfig: ApiConfigModel,
		files: FilesModel,
		mcp: McpModel,
		models: ModelsModel,
		modes: ModesModel,
		prompts: PromptsModel,
		skills: SkillsModel,
		webview: WebviewModel,
		settingsImportedAt: types.number,
	})
	.actions((self) => ({
		setSettingsImportedAt(value: number) {
			self.settingsImportedAt = value
		},
	}))

/** Root settings state — sub-features manage their own slices */
export type SettingsRootState = object

export function initSettingsState(_provider: EventBridge): void {
	// All settings sub-models use types.optional(Model, {}) in store.ts,
	// so MST provides default values automatically. No direct mutations needed.
}

export function getSettingsState(rootStore: IBackendRootStore): SettingsRootState {
	return rootStore.settings as SettingsRootState
}
