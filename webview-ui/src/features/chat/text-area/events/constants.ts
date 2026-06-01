import { eventConstants } from "@jabberwock/types"

/**
 * TextArea event keys — maps to backend feature-level events.
 * Uses shared event constants from the types package.
 */
export const textAreaEventConstants = {
	SELECT_IMAGES: eventConstants.CHAT.TEXT_AREA.SELECT_IMAGES,
	SEARCH_FILES: eventConstants.CHAT.TEXT_AREA.SEARCH_FILES,
	DRAGGED_IMAGES: eventConstants.CHAT.TEXT_AREA.DRAGGED_IMAGES,
	ENHANCE_PROMPT: eventConstants.CHAT.TEXT_AREA.ENHANCE_PROMPT,
	FILE_SEARCH_RESULTS: "fileSearchResults",
	INSERT_TEXT: "insertTextIntoTextarea",
	ENHANCED_PROMPT: "enhancedPrompt",
} as const
