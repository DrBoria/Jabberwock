// Barrel file for messages/actions/
export { readApiConversation, saveApiMessages } from "./save/io"
export { type ApiMessage } from "./save/types"
export { buildCleanConversationHistory } from "./save/transform"
export {
	readTaskMessages,
	saveTaskMessages,
	saveMessages,
	findMessageByTimestamp,
	type TaskMetadataOptions,
} from "./save"
export { resolveImageMentions } from "./mentions/resolve-images"
export { presentAssistantMessage } from "./presentAssistantMessage/index"
export type { AssistantMessageContent } from "./buildMessageTypes"
export * from "./say"
// Split persistence modules (flattened from "messagePersistence.ts")
export { addMessage } from "./addMessage"
export { overwriteMessages, updateMessage } from "./updateMessage"

export { saveApiConversationHistory, retrySaveApiConversationHistory, getSavedApiConversationHistory } from "./save/io"
export { getSavedMessages } from "./command/getSavedMessages"
