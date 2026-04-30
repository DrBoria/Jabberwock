import { types, Instance } from "mobx-state-tree"

/**
 * SkillsStore — tracks available skills.
 * Receives snapshots from the extension-side SkillsStore via MstBridge.
 */
export const SkillsStore = types
	.model("SkillsStore", {
		skills: types.optional(types.array(types.frozen<any>()), []),
	})
	.actions((self) => ({
		setSkills(skills: any[]) {
			self.skills.replace(skills)
		},
	}))

export type ISkillsStore = Instance<typeof SkillsStore>
export const skillsStore = SkillsStore.create({})
