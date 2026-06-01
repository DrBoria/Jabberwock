import type { IntentBus } from "../../../intents/bus"
import { IntentConstants } from "@intentConstants"
import type { IntentHandlerContext } from "../../../intents/context"
import { getRootStore } from "../../../root-store"

/**
 * Register all frontend chat event handlers on the IntentBus.
 */
export function registerOnFrontendChatIntents(bus: IntentBus): void {
	bus.register(IntentConstants.chat.INVOKE_RECEIVED, async (intent, _ctx: IntentHandlerContext) => {
		const store = getRootStore()
		const payload = intent.payload as {
			invoke?: string
			text?: string
			images?: string[]
			values?: Record<string, unknown>
		}
		const invoke = payload.invoke

		if (invoke === "newChat") {
			store.chat.clearInput()
			store.chat.setSendingDisabled(false)
		} else if (invoke === "sendMessage") {
			store.chat.sendMessage(payload.text ?? "", payload.images ?? [])
		} else if (invoke === "setChatBoxMessage") {
			store.chat.setInputValue(
				store.chat.inputValue !== ""
					? store.chat.inputValue + " " + (payload.text ?? "")
					: (payload.text ?? ""),
			)
			store.chat.appendSelectedImages(payload.images ?? [])
		} else if (invoke === "primaryButtonClick") {
			const primaryClineAsk = store.chat.currentAsk
			if (primaryClineAsk === "command_output") {
				store.settings.terminalOperation("continue")
			}
			store.chat.handlePrimaryButtonClick(undefined, undefined, [], payload.text ?? "", payload.images ?? [])
		} else if (invoke === "secondaryButtonClick") {
			if (store.chat.isStreaming) {
				store.chat.cancelTask()
			} else {
				const secondaryClineAsk = store.chat.currentAsk
				if (secondaryClineAsk === "command_output") {
					store.settings.terminalOperation("abort")
				}
				store.chat.handleSecondaryButtonClick(undefined, false, payload.text ?? "", payload.images ?? [])
			}
		} else if (invoke === "approveTodoPlan") {
			if (payload.values) {
				store.chat.elicitResponse(payload.values!)
			} else {
				document
					.querySelectorAll("iframe")
					.forEach((iframe) => iframe.contentWindow?.postMessage({ type: "mcp-force-accept" }, "*"))
			}
		}
	})

	bus.register(IntentConstants.chat.INTERACTION_REQUIRED, async (_intent, _ctx: IntentHandlerContext) => {
		// No-op: intent is acknowledged, UI reacts naturally
	})
}
