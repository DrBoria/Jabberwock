import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents"
import { SETTING_HANDLERS } from "./setting-handlers"
import type { TelemetrySetting, JabberwockSettings } from "@jabberwock/types"
import { getTelemetryService, hasTelemetryService } from "@jabberwock/telemetry"
import * as os from "os"
import * as path from "path"
import * as fs from "fs/promises"
import type { IBackendRootStore } from "@features/store"
import { getHostEnvironment, getHostContext } from "@features/foundation"
import { getUiDialogs } from "@features/foundation"
import { postStateToWebview, WebviewStatePayload } from "@features/foundation"
import { log as backendLog } from "@features/foundation"
import { t } from "@i18n"
import { getSettingsAccess } from "@utils/settings"
import { sendDismissedUpsells } from "@features/settings"
import { captureTelemetryChange } from "./register-debug"
import { publishNotificationError } from "@features/foundation"

function registerUpdatesSettingsUpdate(bus: IntentBus): void {
	bus.register(IntentType.SettingsUpdate, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) {
			return
		}

		const payload = intent.payload as { updatedSettings: { [key: string]: unknown } }
		if (!payload.updatedSettings) {
			return
		}

		try {
			for (const [key, value] of Object.entries(payload.updatedSettings)) {
				const handler = SETTING_HANDLERS[key]
				if (!handler) {
					continue
				}

				const newValue = await handler(value)
				await getSettingsAccess().setValue(
					key as keyof JabberwockSettings,
					newValue as JabberwockSettings[keyof JabberwockSettings],
				)
			}

			const keys = Object.keys(payload.updatedSettings)
			const settingsState: WebviewStatePayload = {}
			for (const key of keys) {
				settingsState[key] = getSettingsAccess().getValue(key as keyof JabberwockSettings)
			}
			await postStateToWebview(provider, keys.length > 0 ? settingsState : undefined)
		} catch (error) {
			console.error(
				`[jabberwock] [updateSettings] Error saving settings:`,
				error instanceof Error ? error.message : String(error),
			)
		}
	})
}

function registerUpdatesSettingsAnnouncementShown(bus: IntentBus): void {
	bus.register(IntentType.SettingsAnnouncementShown, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) {
			return
		}
		await postStateToWebview(provider)
	})
}

function registerUpdatesSettingsUpsellsDismissedGet(bus: IntentBus): void {
	bus.register(IntentType.SettingsUpsellsDismissedGet, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) {
			return
		}
		const dismissedUpsells = getHostEnvironment().getGlobalState("dismissedUpsells") || []
		await sendDismissedUpsells(provider, dismissedUpsells)
	})
}

function registerUpdatesSettingsUpsellDismiss(bus: IntentBus): void {
	bus.register(IntentType.SettingsUpsellDismiss, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) {
			return
		}
		const payload = intent.payload as { upsellId: string }
		if (!payload.upsellId) {
			return
		}

		try {
			const dismissedUpsells: string[] = getHostEnvironment().getGlobalState("dismissedUpsells") || []
			if (dismissedUpsells.includes(payload.upsellId)) {
				return
			}
			const updatedList = [...dismissedUpsells, payload.upsellId]
			await getHostEnvironment().updateGlobalState("dismissedUpsells", updatedList)
			await sendDismissedUpsells(provider, updatedList)
		} catch (error) {
			backendLog.info(`Failed to dismiss upsell: ${error instanceof Error ? error.message : String(error)}`)
		}
	})
}

function registerUpdatesSettingsKeyboardShortcutsOpen(bus: IntentBus): void {
	bus.register(IntentType.SettingsKeyboardShortcutsOpen, async (intent, _ctx) => {
		const payload = intent.payload as { text?: string }
		const searchQuery = payload.text || ""
		// D4g-2 (batch 3): host command via the hostCommands slot (D4g-pre) — server mode has no
		// command palette, so this degrades to a no-op.
		if (searchQuery) {
			getHostContext()?.hostCommands?.executeCommand?.("workbench.action.openGlobalKeybindings", searchQuery)
		} else {
			getHostContext()?.hostCommands?.executeCommand?.("workbench.action.openGlobalKeybindings")
		}
	})
}

function registerUpdatesSettingsMarkdownPreviewOpen(bus: IntentBus): void {
	bus.register(IntentType.SettingsMarkdownPreviewOpen, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) {
			return
		}
		const payload = intent.payload as { text: string }
		if (!payload.text) {
			return
		}

		try {
			const tmpDir = os.tmpdir()
			const timestamp = Date.now()
			const tempFileName = `jabberwock-preview-${timestamp}.md`
			const tempFilePath = path.join(tmpDir, tempFileName)

			await fs.writeFile(tempFilePath, payload.text, "utf8")

			// D4g-2 (batch 3): open the markdown preview via the hostCommands slot (D4g-pre) —
			// server mode has no host preview, so this degrades to a no-op.
			getHostContext()?.hostCommands?.openMarkdownPreview?.(tempFilePath)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			backendLog.info(`Error opening markdown preview: ${errorMessage}`)
			publishNotificationError(`Failed to open markdown preview: ${errorMessage}`)
		}
	})
}

function registerUpdatesSettingsTelemetrySet(bus: IntentBus): void {
	bus.register(IntentType.SettingsTelemetrySet, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) {
			return
		}
		const payload = intent.payload as { text: string }
		const telemetrySetting = payload.text as TelemetrySetting
		const previousSetting = getHostEnvironment().getGlobalState<TelemetrySetting>("telemetrySetting") || "unset"
		const isOptedIn = telemetrySetting !== "disabled"
		const wasPreviouslyOptedIn = previousSetting !== "disabled"

		captureTelemetryChange(wasPreviouslyOptedIn, isOptedIn, previousSetting, telemetrySetting)

		await getHostEnvironment().updateGlobalState("telemetrySetting", telemetrySetting)

		if (hasTelemetryService()) {
			getTelemetryService().updateTelemetryState(isOptedIn)
		}

		await postStateToWebview(provider)
	})
}

function registerUpdatesSettingsTerminalOperationAction(bus: IntentBus): void {
	bus.register(IntentType.SettingsTerminalOperationAction, async (intent, ctx) => {
		const payload = intent.payload as { terminalOperation: unknown }
		if (payload.terminalOperation) {
			;(ctx.rootStore as IBackendRootStore).chat.activeTask?.handleTerminalOperation(payload.terminalOperation)
		}
	})
}

function registerUpdatesSettingsMdmAuthNotification(bus: IntentBus): void {
	bus.register(IntentType.SettingsMdmAuthNotification, async () => {
		// D4g-2 (batch 3): warning toast via the uiDialogs slot (D4c) — server mode logs and no-ops.
		await getUiDialogs().showWarningMessage(t("common:mdm.info.organization_requires_auth"))
	})
}

export function registerUpdates(_bus: IntentBus): void {
	registerUpdatesSettingsUpdate(_bus)
	registerUpdatesSettingsAnnouncementShown(_bus)
	registerUpdatesSettingsUpsellsDismissedGet(_bus)
	registerUpdatesSettingsUpsellDismiss(_bus)
	registerUpdatesSettingsKeyboardShortcutsOpen(_bus)
	registerUpdatesSettingsMarkdownPreviewOpen(_bus)
	registerUpdatesSettingsTelemetrySet(_bus)
	registerUpdatesSettingsTerminalOperationAction(_bus)
	registerUpdatesSettingsMdmAuthNotification(_bus)
}
