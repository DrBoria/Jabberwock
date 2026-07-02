// Barrel file for messages/actions/
export { readApiConversation, saveApiMessages } from "./save/saveApiMessages"
export { type ApiMessage } from "./save/saveApiMessages.types"
export { buildCleanConversationHistory } from "./save/saveApiMessages.helpers"
export {
	readTaskMessages,
	saveTaskMessages,
	saveMessages,
	findMessageByTimestamp,
	type TaskMetadataOptions,
} from "./saveMessages/index"
export { resolveImageMentions } from "./mentions/resolveImageMentions"
export { presentAssistantMessage } from "./presentAssistantMessage/index"
export type { AssistantMessageContent } from "./types"
// Split persistence modules (flattened from messagePersistence.ts)
export { addMessage } from "./addMessage"
export { overwriteMessages, updateMessage } from "./updateMessage"

export {
	saveApiConversationHistory,
	retrySaveApiConversationHistory,
	getSavedApiConversationHistory,
} from "./save/saveApiConversationHistory"
export { getSavedMessages } from "./command/getSavedMessages"
export { handleNotificationMessage } from "./command/handleNotificationMessage"
