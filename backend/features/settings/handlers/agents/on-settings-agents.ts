import { IntentType, type ModeConfig } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import { getAllModes } from "@shared/modes"
import { postStateToWebview } from "@features/foundation/window-manager/store"
import { getHostEnvironment } from "@features/foundation/host-context/context"
import { checkRulesDirectoryHasContent, getCustomModesFilePath, requireContext } from "@features/settings/agents"
import { openFile } from "@integrations/misc/open-file"

import {
	handleUpdateCustomMode,
	handleDeleteCustomMode,
	handleExportMode,
	handleImportMode,
} from "./on-settings-agents.handlers"

export function registerOnSettingsAgents(bus: IntentBus): void {
	bus.register(IntentType.SettingsModeCustomUpdate, handleUpdateCustomMode)
	bus.register(IntentType.SettingsModeCustomDelete, handleDeleteCustomMode)
	bus.register(IntentType.SettingsModeExport, handleExportMode)
	bus.register(IntentType.SettingsModeImport, handleImportMode)

	bus.register(IntentType.SettingsModeRulesDirectoryCheck, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) {
			return
		}

		const payload = intent.payload as { slug: string }
		if (!payload.slug) {
			return
		}

		const hasContent = await checkRulesDirectoryHasContent(payload.slug)

		provider.postMessageToWebview({
			type: "checkRulesDirectoryResult",
			slug: payload.slug,
			hasContent,
		})
	})

	bus.register(IntentType.SettingsModeSelectorOpened, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) {
			return
		}

		const payload = intent.payload as { bool: boolean }
		await getHostEnvironment().updateGlobalState("hasOpenedModeSelector", payload.bool ?? true)
		await postStateToWebview(provider)
	})

	bus.register(IntentType.SettingsModesRequest, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) {
			return
		}

		try {
			const customModes = ctx.rootStore.settings.modes.customModes as ModeConfig[]
			const modes = getAllModes(customModes) as { slug: string; name: string }[]
			await provider.postMessageToWebview({ type: "modes", modes })
		} catch (error) {
			console.error(
				`Error fetching modes: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
			)
			await provider.postMessageToWebview({ type: "modes", modes: [] })
		}
	})

	bus.register(IntentType.SettingsModeCustomSettingsOpen, async () => {
		const customModesFilePath = await getCustomModesFilePath(requireContext())
		if (customModesFilePath) {
			openFile(customModesFilePath)
		}
	})
}
