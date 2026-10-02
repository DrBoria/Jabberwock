import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents"
import { getHostEnvironment } from "@features/foundation"

import { getConfiguration } from "@features/foundation"

import { sendVsCodeSetting } from "@features/settings"

import { publishNotificationError } from "@features/foundation"

const __moduleState = {
	ALLOWED_VSCODE_SETTINGS: new Set(["terminal.integrated.inheritEnv"]),
}

/**
 * Register all VSCode settings intent handlers.
 */

function registerOnSettingsVscodeSettingsVscodeSettingUpdate(bus: IntentBus): void {
	bus.register(IntentType.SettingsVscodeSettingUpdate, async (intent) => {
		const payload = intent.payload as { setting: string; value: unknown }
		const setting = payload.setting
		const value = payload.value

		if (setting !== undefined && value !== undefined) {
			if (__moduleState.ALLOWED_VSCODE_SETTINGS.has(setting)) {
				// D4g-2 (batch 3): config write via the capability slot (D4b) — the vscode connector
				// backs IConfiguration.update with getConfiguration(section).update(key, value, Global).
				// The empty section is the root configuration (the setting is a full dotted key).
				await getConfiguration().update("", setting, value)
			} else {
				publishNotificationError(`Cannot update restricted VSCode setting: ${setting}`)
			}
		}
	})
}

function registerOnSettingsVscodeSettingsVscodeSettingGet(bus: IntentBus): void {
	bus.register(IntentType.SettingsVscodeSettingGet, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { setting: string }
		const setting = payload.setting

		if (setting) {
			try {
				// D4g-2 (batch 3): config read via the capability slot (D4b) — root configuration
				// (empty section), the setting is a full dotted key.
				await sendVsCodeSetting(provider, { setting, value: getConfiguration().get("", setting) })
			} catch (error: unknown) {
				const errorMsg = error instanceof Error ? error.message : String(error)
				console.error(`[jabberwock] Failed to get VSCode setting ${setting}:`, error)

				await sendVsCodeSetting(provider, {
					setting,
					error: `Failed to get setting: ${errorMsg}`,
					value: undefined,
				})
			}
		}
	})
}

function registerOnSettingsVscodeSettingsAutoApprovalEnabled(bus: IntentBus): void {
	bus.register(IntentType.SettingsAutoApprovalEnabled, async (intent) => {
		const payload = intent.payload as { bool: boolean }
		const bool = payload.bool ?? false
		await getHostEnvironment().updateGlobalState("autoApprovalEnabled", bool)
	})
}

function registerOnSettingsVscodeSettingsDebugSetting(bus: IntentBus): void {
	bus.register(IntentType.SettingsDebugSetting, async (intent) => {
		const payload = intent.payload as { bool: boolean }
		const bool = payload.bool ?? false
		await getHostEnvironment().extensionContext.globalState.update("debugSetting", bool)
	})
}

export function registerOnSettingsVscode(_bus: IntentBus): void {
	registerOnSettingsVscodeSettingsVscodeSettingUpdate(_bus)
	registerOnSettingsVscodeSettingsVscodeSettingGet(_bus)
	registerOnSettingsVscodeSettingsAutoApprovalEnabled(_bus)
	registerOnSettingsVscodeSettingsDebugSetting(_bus)
}
