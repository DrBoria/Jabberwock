import { types, Instance } from "mobx-state-tree"
import type { EventBridge } from "@features/foundation/webview/EventBridge"
import type { SkillsManager } from "@services/skills/SkillsManager"

/**
 * Custom MST type for storing a reference to a SkillsManager instance.
 * The instance itself is non-serializable, so the snapshot is just a label.
 */
const SkillsManagerRef = types.custom<string, SkillsManager | null>({
	name: "SkillsManagerRef",
	fromSnapshot() {
		return null
	},
	toSnapshot() {
		return ""
	},
	isTargetType(value: unknown): value is SkillsManager {
		return value !== null && typeof value === "object"
	},
	getValidationMessage() {
		return ""
	},
})

export const SkillsModel = types.model("Skills", {
	skillsManager: SkillsManagerRef,
})

export type ISkillsModel = Instance<typeof SkillsModel>

// Backward-compatible types and functions
export interface SkillsState {
	skillsManager?: SkillsManager
}

export function initSkillsState(_provider: EventBridge): void {}

import type { IBackendRootStore } from "@features/store"

export function getSkillsState(rootStore: IBackendRootStore): SkillsState {
	return rootStore.settings.skills as SkillsState
}

export function getSkillsManager(rootStore: IBackendRootStore): SkillsManager | undefined {
	return rootStore.settings.skills.skillsManager ?? undefined
}

export type { SkillsManager }
