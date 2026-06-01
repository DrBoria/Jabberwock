import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "../../../intents/bus"
import { postStateToWebview } from "../../../foundation/window-manager/store"
import { loadAndMergeModes, requireContext } from "../modesFileService"

/**
 * Handler for SettingsModeFileChanged intent.
 *
 * Reloads modes from disk and posts updated state to webview.
 * Used when the customModes.yaml or .jabberwockmodes file changes on disk,
 * or after a CRUD operation that mutates modes files.
 */
export function registerOnModesFileChanged(bus: IntentBus): void {
	bus.register(IntentType.SettingsModeFileChanged, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		try {
			const context = requireContext()
			await loadAndMergeModes(context)
			await postStateToWebview(provider)
		} catch (error) {
			console.error("[jabberwock] [onModesFileChanged] Failed to reload modes:", error)
		}
	})
}
