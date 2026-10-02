import { IntentType, type ModeConfig } from "@jabberwock/types"
import type { IntentBus } from "@features/intents"
import { getAllModes } from "@shared/modes"
import { postStateToWebview } from "@features/foundation"
import { getHostEnvironment } from "@features/foundation"
import { checkRulesDirectoryHasContent, getCustomModesFilePath, requireContext } from "@features/settings/agents"
import { sendCheckRulesDirectoryResult, sendModes } from "@features/settings"
import { openFile } from "@integrations/misc/open-file"

import { handleUpdateCustomMode, handleDeleteCustomMode, handleExportMode, handleImportMode } from "./handlers"

function registerOnSettingsAgentsSettingsModeCustomUpdate(bus: IntentBus): void {
	bus.register(IntentType.SettingsModeCustomUpdate, handleUpdateCustomMode)
}

function registerOnSettingsAgentsSettingsModeCustomDelete(bus: IntentBus): void {
	bus.register(IntentType.SettingsModeCustomDelete, handleDeleteCustomMode)
}

function registerOnSettingsAgentsSettingsModeExport(bus: IntentBus): void {
	bus.register(IntentType.SettingsModeExport, handleExportMode)
}

function registerOnSettingsAgentsSettingsModeImport(bus: IntentBus): void {
	bus.register(IntentType.SettingsModeImport, handleImportMode)
}

function registerOnSettingsAgentsSettingsModeRulesDirectoryCheck(bus: IntentBus): void {
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

		sendCheckRulesDirectoryResult(provider, {
			slug: payload.slug,
			hasContent,
		})
	})
}

function registerOnSettingsAgentsSettingsModeSelectorOpened(bus: IntentBus): void {
	bus.register(IntentType.SettingsModeSelectorOpened, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) {
			return
		}

		const payload = intent.payload as { bool: boolean }
		await getHostEnvironment().updateGlobalState("hasOpenedModeSelector", payload.bool ?? true)
		await postStateToWebview(provider)
	})
}

function registerOnSettingsAgentsSettingsModesRequest(bus: IntentBus): void {
	bus.register(IntentType.SettingsModesRequest, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) {
			return
		}

		try {
			const customModes = ctx.rootStore.settings.modes.customModes as ModeConfig[]
			const modes = getAllModes(customModes) as { slug: string; name: string }[]
			await sendModes(provider, modes)
		} catch (error) {
			console.error(
				`Error fetching modes: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
			)
			await sendModes(provider, [])
		}
	})
}

function registerOnSettingsAgentsSettingsModeCustomSettingsOpen(bus: IntentBus): void {
	bus.register(IntentType.SettingsModeCustomSettingsOpen, async () => {
		const customModesFilePath = await getCustomModesFilePath(requireContext())
		if (customModesFilePath) {
			openFile(customModesFilePath)
		}
	})
}

export function registerOnSettingsAgents(_bus: IntentBus): void {
	registerOnSettingsAgentsSettingsModeCustomUpdate(_bus)
	registerOnSettingsAgentsSettingsModeCustomDelete(_bus)
	registerOnSettingsAgentsSettingsModeExport(_bus)
	registerOnSettingsAgentsSettingsModeImport(_bus)
	registerOnSettingsAgentsSettingsModeRulesDirectoryCheck(_bus)
	registerOnSettingsAgentsSettingsModeSelectorOpened(_bus)
	registerOnSettingsAgentsSettingsModesRequest(_bus)
	registerOnSettingsAgentsSettingsModeCustomSettingsOpen(_bus)
}
