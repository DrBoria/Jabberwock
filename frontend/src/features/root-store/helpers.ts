import type { ExtensionMessage, ExtensionState } from "@jabberwock/types"
import { IntentConstants } from "@intentConstants"
import { streamingStore } from "../api/streaming/store"
import { jabberwockLog } from "../../utils/misc/jabberwock-logger"

export const logIncomingMessages = (messages: ExtensionState["messages"] | undefined) => {
	if (!messages?.length) return
	const lm = messages[messages.length - 1]
	jabberwockLog.log("state:messages", {
		count: messages.length,
		lastMessageType: `${lm.type}:${lm.say ?? lm.ask ?? "unknown"}`,
		hasPendingAsks: messages.some((m) => m.type === "ask"),
	})
}
export const shouldProtectStaleMessages = (
	ns: number | undefined,
	ps: number | undefined,
	nm: ExtensionState["messages"] | undefined,
) => ns !== undefined && ps !== undefined && ns <= ps && nm !== undefined
export const handleDomAction = (
	message: ExtensionMessage,
	chat: { textArea: { sendingDisabled: boolean }; enableButtons: boolean },
) => {
	if (message.type !== "action") return false
	if (message.action === "didBecomeVisible") {
		if (!chat.textArea.sendingDisabled && !chat.enableButtons)
			document.querySelector<HTMLTextAreaElement>("textarea")?.focus()
		return true
	}
	if (message.action === "focusInput") {
		document.querySelector<HTMLTextAreaElement>("textarea")?.focus()
		return true
	}
	return false
}
export const handleStreamChunk = (message: ExtensionMessage, chat?: { setIsStreaming: (v: boolean) => void }) => {
	if (message.type !== "streamChunk") return false
	const { taskId, text, reset } = message as {
		type: string
		taskId: string
		text: string
		reset?: boolean
	}
	// Reset signal from the backend: clear the streaming store before a new
	// stream attempt (e.g. on retry). Without this, new chunks are appended
	// to the previous failed attempt's text, causing visible stuttering.
	if (reset) {
		streamingStore.start(taskId)
		chat?.setIsStreaming(true)
		return true
	}
	if (!streamingStore.getSnapshot().isActive) {
		streamingStore.start(taskId)
		chat?.setIsStreaming(true)
	}
	streamingStore.appendChunk(text)
	return true
}

export const handleExtensionMessageDispatchMap: Record<string, string> = {
	showInteractiveApp: IntentConstants.foundation.SHOW_INTERACTIVE_APP,
	state: IntentConstants.task.STATE_RECEIVED,
	action: IntentConstants.task.ACTION_RECEIVED,
	theme: IntentConstants.settings.THEME_UPDATED,
	workspaceUpdated: IntentConstants.foundation.WORKSPACE_UPDATED,
	commands: IntentConstants.foundation.COMMANDS_UPDATED,
	messageUpdated: IntentConstants.task.MESSAGES_UPDATED,
	skills: IntentConstants.settings.SKILLS,
	mcpServers: IntentConstants.settings.MCP_SERVERS,
	currentCheckpointUpdated: IntentConstants.task.CHECKPOINT_UPDATED,
	listApiConfig: IntentConstants.settings.LIST_API_CONFIG,
	routerModels: IntentConstants.settings.ROUTER_MODELS,
	marketplaceData: IntentConstants.marketplace.DATA_RECEIVED,
	taskHistoryUpdated: IntentConstants.history.UPDATED,
	taskHistoryItemUpdated: IntentConstants.history.ITEM_UPDATED,
	diagnostics: IntentConstants.diagnostics.RECEIVED,
	invoke: IntentConstants.chat.INVOKE_RECEIVED,
	selectedImages: IntentConstants.task.SELECTED_IMAGES,
	condenseTaskContextStarted: IntentConstants.task.CONDENSE_STARTED,
	condenseTaskContextResponse: IntentConstants.task.CONDENSE_RESPONSE,
	checkpointInitWarning: IntentConstants.task.CHECKPOINT_INIT_WARNING,
	interactionRequired: IntentConstants.chat.INTERACTION_REQUIRED,
	taskWithAggregatedCosts: IntentConstants.task.TASK_WITH_AGGREGATED_COSTS,
}
