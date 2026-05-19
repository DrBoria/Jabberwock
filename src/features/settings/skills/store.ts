import { types, Instance } from "mobx-state-tree"
import type { EventBridge } from "../../../core/webview/EventBridge"
import type { SkillsManager } from "../../../services/skills/SkillsManager"
import { getState } from "../../storeSingleton"

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

export function getSkillsState(provider: EventBridge): SkillsState {
	return getState(provider).settings.skills as SkillsState
}

export function getSkillsManager(provider: EventBridge): SkillsManager | undefined {
	return getState(provider).settings.skills.skillsManager ?? undefined
}
