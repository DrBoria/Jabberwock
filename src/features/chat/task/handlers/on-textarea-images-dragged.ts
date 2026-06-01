import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "../../../intents/bus"

/**
 * Handles textarea.images.dragged intent — forwards dragged images to the webview.
 */
export function registerOnTextareaImagesDragged(bus: IntentBus): void {
	bus.register(IntentType.TextareaImagesDragged, async (intent, ctx) => {
		const provider = ctx.provider
		const { images } = intent.payload as { images?: string[] }

		if (!provider || !images) {
			return
		}

		await provider.postMessageToWebview({
			type: "draggedImages" as const,
			images,
		})
	})
}
