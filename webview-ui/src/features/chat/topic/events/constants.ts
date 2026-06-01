import { eventConstants } from "@jabberwock/types"

/**
 * Topic event keys — maps to backend feature-level events.
 * Uses shared event constants from the types package.
 */
export const topicEventConstants = {
	SWITCH_MODE: eventConstants.CHAT.TOPIC.MODE,
	REQUEST_COMMANDS: eventConstants.CHAT.TOPIC.REQUEST_COMMANDS,
	TASK_HISTORY_UPDATED: "taskHistoryUpdated",
	HISTORY_ITEM_UPDATED: "taskHistoryItemUpdated",
	COMMANDS: "commands",
	MODES: "modes",
} as const
