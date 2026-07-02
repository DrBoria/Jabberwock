import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import { selectImages } from "@integrations/misc/process-images"

/**
 * Handles textarea.images.select.requested intent — opens image picker.
 */
export function registerOnTextareaImagesSelectRequested(bus: IntentBus): void {
	bus.register(IntentType.TextareaImagesSelectRequested, async (_intent, ctx) => {
		const provider = ctx.provider

		if (!provider) {
			return
		}

		const images = await selectImages()
		await provider.postMessageToWebview({
			type: "selectedImages",
			images,
			context: (_intent.payload as { [key: string]: unknown }).context,
			messageTs: (_intent.payload as { [key: string]: unknown }).messageTs,
		})
	})
}
