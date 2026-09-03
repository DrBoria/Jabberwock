import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import * as vscode from "vscode"
import { getHostEnvironment } from "@features/foundation/host-context/context"

const ALLOWED_VSCODE_SETTINGS = new Set(["terminal.integrated.inheritEnv"])

/**
 * Register all VSCode settings intent handlers.
 */
export function registerOnSettingsVscode(bus: IntentBus): void {
	// ── updateVSCodeSetting ───────────────────────────────────────────
	bus.register(IntentType.SettingsVscodeSettingUpdate, async (intent) => {
		const payload = intent.payload as { setting: string; value: unknown }
		const setting = payload.setting
		const value = payload.value

		if (setting !== undefined && value !== undefined) {
			if (ALLOWED_VSCODE_SETTINGS.has(setting)) {
				await vscode.workspace.getConfiguration().update(setting, value, true)
			} else {
				publishNotificationError(`Cannot update restricted VSCode setting: ${setting}`)
			}
		}
	})

	// ── getVSCodeSetting ──────────────────────────────────────────────
	bus.register(IntentType.SettingsVscodeSettingGet, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { setting: string }
		const setting = payload.setting

		if (setting) {
			try {
				await provider.postMessageToWebview({
					type: "vsCodeSetting",
					setting,
					value: vscode.workspace.getConfiguration().get(setting),
				})
			} catch (error: unknown) {
				const errorMsg = error instanceof Error ? error.message : String(error)
				console.error(`[jabberwock] Failed to get VSCode setting ${setting}:`, error)

				await provider.postMessageToWebview({
					type: "vsCodeSetting",
					setting,
					error: `Failed to get setting: ${errorMsg}`,
					value: undefined,
				})
			}
		}
	})

	// ── autoApprovalEnabled ───────────────────────────────────────────
	bus.register(IntentType.SettingsAutoApprovalEnabled, async (intent) => {
		const payload = intent.payload as { bool: boolean }
		const bool = payload.bool ?? false
		await getHostEnvironment().updateGlobalState("autoApprovalEnabled", bool)
	})

	// ── debugSetting ─────────────────────────────────────────────────
	bus.register(IntentType.SettingsDebugSetting, async (intent) => {
		const payload = intent.payload as { bool: boolean }
		const bool = payload.bool ?? false
		await getHostEnvironment().extensionContext.globalState.update("debugSetting", bool)
	})
}

import { publishNotificationError } from "@features/foundation/capabilities/notifications"
