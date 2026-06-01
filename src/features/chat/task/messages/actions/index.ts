// Barrel file for messages/actions/
export { type ApiMessage, readApiConversation, saveApiMessages } from "./saveApiConversation"
export { readTaskMessages, saveTaskMessages } from "./saveMessages"
export { resolveImageMentions } from "./resolveImageMentions"
export { presentAssistantMessage } from "./presentAssistantMessage"
export type { AssistantMessageContent } from "./types"
// Split persistence modules (flattened from messagePersistence.ts)
export { addMessage } from "./addMessage"
export { overwriteMessages, updateMessage } from "./updateMessage"
export { saveMessages, findMessageByTimestamp, type TaskMetadataOptions } from "./persistMessages"
export {
	saveApiConversationHistory,
	retrySaveApiConversationHistory,
	getSavedApiConversationHistory,
} from "./apiHistoryPersistence"
export { getSavedMessages } from "./getSavedMessages"
export { handleNotificationMessage } from "./handleNotificationMessage"
