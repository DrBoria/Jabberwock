/**
 * Skills event key constants.
 *
 * These keys map 1:1 to the event types sent via EventBridge IPC.
 * Naming convention: [Feature]_[Action] in UPPER_SNAKE_CASE.
 */
export const SkillsEventKeys = {
	SKILLS_REQUESTED: "skills.requested",
	SKILLS_CREATE_REQUESTED: "skills.create.requested",
	SKILLS_DELETE_REQUESTED: "skills.delete.requested",
	SKILLS_MOVE_REQUESTED: "skills.move.requested",
	SKILLS_MODES_UPDATE_REQUESTED: "skills.modes.update.requested",
	SKILLS_FILE_OPEN_REQUESTED: "skills.file.open.requested",
	SKILLS_UPDATED: "skills.updated",
} as const

export type SkillsEventKeys = (typeof SkillsEventKeys)[keyof typeof SkillsEventKeys]
