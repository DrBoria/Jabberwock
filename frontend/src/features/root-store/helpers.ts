import type { ExtensionMessage, ExtensionState } from "@jabberwock/types"
import { IntentConstants } from "@intentConstants"
import { streamingStore } from "@src/features/api/streaming"
import { prefillStore } from "@src/features/api/prefill"
import { jabberwockLog } from "@src/utils/misc/jabberwock-logger"
import type { RootStoreSelf } from "./types"

/**
 * Factory for the many root-store setters that only spread a single field into
 * `extensionState`. Each caller gets a `(value) => void` setter, so the ~50
 * near-identical `setX(v) { self.extensionState = { ...self.extensionState, x: v } }`
 * bodies across part1/part2 collapse to one shared implementation.
 */
export function setExtensionStateField<K extends keyof ExtensionState>(
	self: RootStoreSelf,
	key: K,
): (value: ExtensionState[K]) => void {
	return (value: ExtensionState[K]) => {
		self.extensionState = { ...self.extensionState, [key]: value }
	}
}

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
export const handlePrefillProgress = (message: ExtensionMessage, chat?: { setIsStreaming: (v: boolean) => void }) => {
	if (message.type !== "prefillProgress") return false
	const { taskId, percent } = message
	if (taskId === undefined) return true
	// percent === null  → poller stopped (generation started / stream ended):
	//                       clear the store so the UI falls back to "Thinking".
	// percent === -1    → provider has no progress signal: indeterminate label.
	// percent >= 0      → real prefill percentage (0-100).
	if (percent === null || percent === undefined) {
		prefillStore.reset()
	} else {
		prefillStore.set(taskId, percent < 0 ? null : percent)
		// A real prefill (percent >= 0) means the request is in flight. The
		// prefill UI gate (isPrefilling) requires `chat.isStreaming`, but for
		// reasoning models the first content is reasoning — no text chunk fires
		// handleStreamChunk, so isStreaming would stay false and the row would
		// show "Thinking" forever instead of the prefill progress bar. Flip it
		// on here. When percent is null (poller stopped) we leave isStreaming
		// alone: the first real chunk or the computeIsStreaming reaction owns
		// it from that point.
		if (percent >= 0) {
			chat?.setIsStreaming(true)
		}
	}
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
