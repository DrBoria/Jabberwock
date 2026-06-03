import { IntentType, ProviderSettings } from "@jabberwock/types"
import type { IntentBus } from "../../intents/bus"
import * as vscode from "vscode"
import { t } from "../../../i18n"
import { getVscodeContext } from "../../foundation/vscode/context"
import { getProviderSettingsManager } from "../models/ProviderSettingsManager"
import { upsertProviderProfile, activateProviderProfile, deleteProviderProfile } from "../models/api-config-store"
import { postStateToWebview } from "@features/foundation/window-manager/store"
import { getMstState } from "../../foundation/mst/store"
import { EventBridge } from "@features/foundation/webview/EventBridge"

/**
 * Register all API config settings intent handlers.
 */

export function registerOnSettingsApiConfig(bus: IntentBus): void {
	// ── saveApiConfiguration ────────────────────────────────────────────
	bus.register(IntentType.SettingsApiConfigSave, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { text: string; apiConfiguration: ProviderSettings }
		if (!payload.text || !payload.apiConfiguration) return

		try {
			await getProviderSettingsManager()!.saveConfig(payload.text, payload.apiConfiguration)
			const listApiConfig = await getProviderSettingsManager()!.listConfig()
			await getVscodeContext().updateGlobalState("listApiConfigMeta", listApiConfig)
		} catch (error) {
			EventBridge.outputChannel?.appendLine(
				`Error save api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
			)
			vscode.window.showErrorMessage(t("common:errors.save_api_config"))
		}
	})

	// ── upsertApiConfiguration ──────────────────────────────────────────
	bus.register(IntentType.SettingsApiConfigUpsert, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { text: string; apiConfiguration: ProviderSettings }
		if (!payload.text || !payload.apiConfiguration) return

		console.log(
			`[handlers/upsertApiConfiguration] START: name="${payload.text}", apiProvider="${payload.apiConfiguration.apiProvider}", apiModelId="${payload.apiConfiguration.apiModelId}"`,
		)
		console.log(`[handlers/upsertApiConfiguration] providerSettingsManager exists:`, !!getProviderSettingsManager())

		try {
			const result = await upsertProviderProfile(provider, payload.text, payload.apiConfiguration, true)

			console.log(`[handlers/upsertApiConfiguration] upsertProviderProfile returned:`, result)

			if (!getProviderSettingsManager()) {
				console.log(
					`[handlers/upsertApiConfiguration] ERROR: providerSettingsManager is undefined - config will NOT be persisted!`,
				)
				vscode.window.showErrorMessage("API config persistence not available. Please reload VS Code.")
				return
			}

			const listApiConfig = await getProviderSettingsManager()!.listConfig()
			console.log(`[handlers/upsertApiConfiguration] listConfig returned ${listApiConfig?.length ?? 0} configs`)

			await getVscodeContext().updateGlobalState("listApiConfigMeta", listApiConfig)
			await getVscodeContext().updateGlobalState("currentApiConfigName", payload.text)
			console.log(
				`[handlers/upsertApiConfiguration] saved currentApiConfigName="${payload.text}" to global state`,
			)

			// Pass the saved apiConfiguration back to the webview so it can
			// synchronize its state with the persisted configuration.
			await postStateToWebview(provider, { apiConfiguration: payload.apiConfiguration })
			console.log(`[handlers/upsertApiConfiguration] DONE: posted state to webview`)
		} catch (error) {
			console.log(
				`[handlers/upsertApiConfiguration] ERROR: ${error instanceof Error ? error.message : String(error)}`,
			)
			EventBridge.outputChannel?.appendLine(
				`Error create new api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
			)
			vscode.window.showErrorMessage(t("common:errors.save_api_config"))
		}
	})

	// ── renameApiConfiguration ─────────────────────────────────────────
	bus.register(IntentType.SettingsApiConfigRename, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as {
			text: string
			values: { oldName: string; newName: string }
			apiConfiguration: ProviderSettings
		}
		if (!payload.values || !payload.apiConfiguration) return

		try {
			const oldName = payload.values.oldName
			const newName = payload.values.newName

			if (oldName === newName) return

			const { id } = await getProviderSettingsManager()!.getProfile({ name: oldName })
			await getProviderSettingsManager()!.saveConfig(newName, { ...payload.apiConfiguration, id })
			await getProviderSettingsManager()!.deleteConfig(oldName)

			await activateProviderProfile(provider, { name: newName })
		} catch (error) {
			EventBridge.outputChannel?.appendLine(
				`Error rename api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
			)
			vscode.window.showErrorMessage(t("common:errors.rename_api_config"))
		}
	})

	// ── deleteApiConfiguration ─────────────────────────────────────────
	bus.register(IntentType.SettingsApiConfigDelete, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { text: string }
		if (!payload.text) return

		const answer = await vscode.window.showInformationMessage(
			t("common:confirmation.delete_config_profile"),
			{ modal: true },
			t("common:answers.yes"),
		)

		if (answer !== t("common:answers.yes")) return

		const oldName = payload.text
		const newName = (await getProviderSettingsManager()!.listConfig()).filter((c) => c.name !== oldName)[0]?.name

		if (!newName) {
			vscode.window.showErrorMessage(t("common:errors.delete_api_config"))
			return
		}

		try {
			await getProviderSettingsManager()!.deleteConfig(oldName)
			await activateProviderProfile(provider, { name: newName })
		} catch (error) {
			EventBridge.outputChannel?.appendLine(
				`Error delete api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
			)
			vscode.window.showErrorMessage(t("common:errors.delete_api_config"))
		}
	})

	// ── loadApiConfiguration ───────────────────────────────────────────
	bus.register(IntentType.SettingsApiConfigLoad, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { text: string }
		if (!payload.text) return

		try {
			const profile = await activateProviderProfile(provider, { name: payload.text })
			if (profile) {
				await getVscodeContext().updateGlobalState("currentApiConfigName", payload.text)
			}
			await postStateToWebview(provider)
		} catch (error) {
			EventBridge.outputChannel?.appendLine(
				`Error load api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
			)
			vscode.window.showErrorMessage(t("common:errors.load_api_config"))
		}
	})

	// ── loadApiConfigurationById ───────────────────────────────────────
	bus.register(IntentType.SettingsApiConfigLoadById, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { text: string }
		if (!payload.text) return

		try {
			const profile = await activateProviderProfile(provider, { id: payload.text })
			if (profile) {
				const configName = typeof profile.name === "string" ? profile.name : undefined
				await getVscodeContext().updateGlobalState("currentApiConfigName", configName)
			}
			await postStateToWebview(provider)
		} catch (error) {
			EventBridge.outputChannel?.appendLine(
				`Error load api configuration by ID: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
			)
			vscode.window.showErrorMessage(t("common:errors.load_api_config"))
		}
	})

	// ── getListApiConfiguration ────────────────────────────────────────
	bus.register(IntentType.SettingsApiConfigList, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		try {
			const listApiConfig = await getProviderSettingsManager()!.listConfig()
			await getVscodeContext().updateGlobalState("listApiConfigMeta", listApiConfig)
			provider.postMessageToWebview({ type: "listApiConfig", listApiConfig })
			getMstState(ctx.rootStore).listApiConfigStore?.setListApiConfig(listApiConfig)
		} catch (error) {
			EventBridge.outputChannel?.appendLine(
				`Error get list api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
			)
			vscode.window.showErrorMessage(t("common:errors.list_api_config"))
		}
	})

	// ── lockApiConfigAcrossModes ───────────────────────────────────────
	bus.register(IntentType.SettingsApiConfigLockModes, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { bool: boolean }
		const enabled = payload.bool ?? false
		await getVscodeContext().extensionContext.workspaceState.update("lockApiConfigAcrossModes", enabled)
		await postStateToWebview(provider)
	})

	// ── toggleApiConfigPin ─────────────────────────────────────────────
	bus.register(IntentType.SettingsApiConfigPinToggle, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { text: string }
		if (!payload.text) return

		const currentPinned = getVscodeContext().getGlobalState("pinnedApiConfigs") ?? ({} as Record<string, boolean>)
		const updatedPinned: Record<string, boolean> = { ...currentPinned }

		if (currentPinned[payload.text]) {
			delete updatedPinned[payload.text]
		} else {
			updatedPinned[payload.text] = true
		}

		await getVscodeContext().updateGlobalState("pinnedApiConfigs", updatedPinned)
		await postStateToWebview(provider)
	})

	// ── enhancementApiConfigId ─────────────────────────────────────────
	bus.register(IntentType.SettingsApiConfigEnhancementId, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { text: string }
		await getVscodeContext().updateGlobalState("enhancementApiConfigId", payload.text)
		await postStateToWebview(provider)
	})

	// ── setApiConfigPassword ───────────────────────────────────────────
	bus.register(IntentType.SettingsApiConfigPasswordSet, async () => {
		// No-op or future implementation
	})
}
