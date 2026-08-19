/**
 * Frontend Chat Task event key constants.
 *
 * Naming convention: [Feature]_[Action] in UPPER_SNAKE_CASE.
 */
export const FrontendChatTaskEventKeys = {
	GOAL_ADD: "goalAdd",
	GOAL_REMOVE: "goalRemove",
	GOAL_UPDATE: "goalUpdate",
	GOAL_REORDER: "goalReorder",
	SHOW_TASK_WITH_ID: "showTaskWithId",
} as const

export type FrontendChatTaskEventKeys = (typeof FrontendChatTaskEventKeys)[keyof typeof FrontendChatTaskEventKeys]
