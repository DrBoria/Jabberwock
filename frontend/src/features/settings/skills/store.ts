import { types, Instance } from "mobx-state-tree"

import type { SkillMetadata } from "@jabberwock/types"

/**
 * SkillsStore — tracks available skills.
 * Receives snapshots from the extension-side SkillsStore via MstBridge.
 */
export const SkillsStore = types
	.model("SkillsStore", {
		skills: types.array(types.frozen<SkillMetadata>()),
	})
	.actions((self) => ({
		setSkills(skills: SkillMetadata[]) {
			self.skills.replace(skills)
		},
	}))

export type ISkillsStore = Instance<typeof SkillsStore>
/** @deprecated Use `getRootStore().skills` instead. Will be removed after all consumers migrate. */
