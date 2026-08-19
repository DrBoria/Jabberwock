import type { Notification } from "../../messages/notification.ts"
import type { ChatMessage } from "../../messages/types.ts"
import type { HistoryItem } from "../../task/history.ts"
import type { Command } from "../../extension/state.ts"
import type { PromptComponent } from "../../models/mode.ts"
import type { MstPatch } from "../../utils/diagnostics.ts"
import type { ExtensionState } from "../../extension/state.ts"

/** Possible values for the "askResponse" event — buttons clicked by user in webview */
export type AskResponseValue = "yesButtonClicked" | "noButtonClicked" | "messageResponse" | "objectResponse"

export interface ChatMessagesListBackendToWebview {
	chatTreeSnapshot: { snapshot: unknown }
	chatTreePatch: { patch: MstPatch[] }
	messageUpdated: { message?: Notification; chatMessage?: ChatMessage }
	showEditMessageDialog: object
	showDeleteMessageDialog: object
}

export interface ChatMessagesListWebviewToBackend {
	askResponse: { askResponse: AskResponseValue; text?: string; images?: string[] }
	deleteMessage: { messageTs?: number }
	deleteMessageConfirm: { messageTs?: number }
	submitEditedMessage: { editedMessageContent?: string; messageTs?: number }
	editMessageConfirm: { editedMessageContent?: string; messageTs?: number }
}

export interface ChatNotificationsBackendToWebview {
	currentCheckpointUpdated: { hasCheckpoint?: boolean }
	checkpointInitWarning: { checkpointWarning?: { type: "WAIT_TIMEOUT" | "INIT_TIMEOUT"; timeout: number } }
	ttsStart: object
	ttsStop: object
	commandExecutionStatus: { text?: string }
	mcpExecutionStatus: { text?: string }
}

export interface ChatNotificationsWebviewToBackend {
	checkpointDiff: object
	checkpointRestore: { restoreCheckpoint?: boolean }
	playSound: object
	playTts: object
	stopTts: object
	ttsEnabled: { bool?: boolean }
	ttsSpeed: { value?: number }
	queueMessage: { text?: string }
	removeQueuedMessage: { messageTs?: number }
	editQueuedMessage: { editedMessageContent?: string; messageTs?: number }
	elicitationResponse: { text?: string }
}

export interface ChatTaskBackendToWebview {
	action: { action?: string }
	state: { state?: Partial<ExtensionState>; text?: string }
	condenseTaskContextStarted: object
	condenseTaskContextResponse: { text?: string }
	acceptInput: object
}

export interface ChatTaskWebviewToBackend {
	newTask: { text: string; images?: string[] }
	cancelTask: object
	clearTask: object
	taskSyncEnabled: { bool?: boolean }
	condenseTaskContextRequest: object
	webviewDidLaunch: object
}

export interface ChatTextAreaBackendToWebview {
	enhancedPrompt: { promptText?: string }
	fileSearchResults: { results?: { path: string; type: "file" | "folder"; label?: string }[] }
	insertTextIntoTextarea: { text?: string }
}

export interface ChatTextAreaWebviewToBackend {
	enhancePrompt: { text?: string; customPrompt?: PromptComponent }
	draggedImages: { images?: string[] }
	selectImages: object
	searchFiles: { query?: string }
}

export interface ChatTopicBackendToWebview {
	taskHistoryUpdated: { taskHistory?: HistoryItem[] }
	taskHistoryItemUpdated: { historyItem?: HistoryItem }
	commands: { commands?: Command[] }
	modes: { modes?: { slug: string; name: string }[] }
	mode: { mode?: string }
}

export interface ChatTopicWebviewToBackend {
	mode: { mode?: string; promptMode?: string | "enhance" }
	requestCommands: object
	switchMode: { mode?: string }
	updateTodoList: { text?: string }
}

export interface ChatBackendToWebview {
	messages: ChatMessagesListBackendToWebview
	notifications: ChatNotificationsBackendToWebview
	task: ChatTaskBackendToWebview
	"text-area": ChatTextAreaBackendToWebview
	topic: ChatTopicBackendToWebview
}

export interface ChatWebviewToBackend {
	messages: ChatMessagesListWebviewToBackend
	notifications: ChatNotificationsWebviewToBackend
	task: ChatTaskWebviewToBackend
	"text-area": ChatTextAreaWebviewToBackend
	topic: ChatTopicWebviewToBackend
}
