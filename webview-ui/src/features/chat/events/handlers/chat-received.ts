import type { IntentBus } from "../../../intents/bus"
import { IntentConstants } from "@intentConstants"
import type { IntentHandlerContext } from "../../../intents/context"
import { getRootStore } from "../../../root-store"

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null
}

function handleNewChat(): void {
	const store = getRootStore()
	store.chat.textArea.clearInput()
	store.chat.textArea.setSendingDisabled(false)
	store.chat.setCurrentAsk("")
	store.chat.setEnableButtons(false)
	store.chat.setPrimaryButtonText("")
	store.chat.setSecondaryButtonText("")
	store.mergeExtensionState({ currentTaskItem: undefined })
}

function handleSendMessage(payload: Record<string, unknown>): void {
	const store = getRootStore()
	const text = typeof payload.text === "string" ? payload.text : undefined
	const images = Array.isArray(payload.images) ? payload.images.filter((i): i is string => typeof i === "string") : []
	store.chat.sendMessage(text ?? "", images)
}

function handleSetChatBoxMessage(payload: Record<string, unknown>): void {
	const store = getRootStore()
	const text = typeof payload.text === "string" ? payload.text : undefined
	const images = Array.isArray(payload.images) ? payload.images.filter((i): i is string => typeof i === "string") : []
	store.chat.textArea.setInputValue(
		store.chat.textArea.inputValue !== "" ? store.chat.textArea.inputValue + " " + (text ?? "") : (text ?? ""),
	)
	store.chat.textArea.appendSelectedImages(images)
}

function handlePrimaryButtonClick(payload: Record<string, unknown>): void {
	const store = getRootStore()
	const primaryClineAsk = store.chat.currentAsk
	if (primaryClineAsk === "command_output") {
		store.settings.terminalOperation("continue")
	}
	const text = typeof payload.text === "string" ? payload.text : undefined
	const images = Array.isArray(payload.images) ? payload.images.filter((i): i is string => typeof i === "string") : []
	store.chat.handlePrimaryButtonClick(undefined, undefined, [], text ?? "", images)
}

function handleSecondaryButtonClick(payload: Record<string, unknown>): void {
	const store = getRootStore()
	if (store.chat.isStreaming) {
		store.chat.cancelTask()
		return
	}
	const secondaryClineAsk = store.chat.currentAsk
	if (secondaryClineAsk === "command_output") {
		store.settings.terminalOperation("abort")
	}
	const text = typeof payload.text === "string" ? payload.text : undefined
	const images = Array.isArray(payload.images) ? payload.images.filter((i): i is string => typeof i === "string") : []
	store.chat.handleSecondaryButtonClick(undefined, false, text ?? "", images)
}

function handleApproveTodoPlan(payload: Record<string, unknown>): void {
	const store = getRootStore()
	const values = isRecord(payload.values) ? payload.values : undefined
	if (values) {
		store.chat.elicitResponse(values)
		return
	}
	document
		.querySelectorAll("iframe")
		.forEach((iframe) => iframe.contentWindow?.postMessage({ type: "mcp-force-accept" }, "*"))
}

/**
 * Register all frontend chat event handlers on the IntentBus.
 */
export function registerOnFrontendChatIntents(bus: IntentBus): void {
	bus.register(IntentConstants.chat.INVOKE_RECEIVED, async (intent, _ctx: IntentHandlerContext) => {
		const payload = intent.payload
		const invoke = typeof payload.invoke === "string" ? payload.invoke : undefined

		if (invoke === "newChat") {
			handleNewChat()
		} else if (invoke === "sendMessage") {
			handleSendMessage(payload)
		} else if (invoke === "setChatBoxMessage") {
			handleSetChatBoxMessage(payload)
		} else if (invoke === "primaryButtonClick") {
			handlePrimaryButtonClick(payload)
		} else if (invoke === "secondaryButtonClick") {
			handleSecondaryButtonClick(payload)
		} else if (invoke === "approveTodoPlan") {
			handleApproveTodoPlan(payload)
		}
	})

	bus.register(IntentConstants.chat.INTERACTION_REQUIRED, async (_intent, _ctx: IntentHandlerContext) => {
		// No-op: intent is acknowledged, UI reacts naturally
	})
}
