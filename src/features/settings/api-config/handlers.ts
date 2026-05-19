import type { EventBridge } from "../../../core/webview/EventBridge"
import type { WebviewMessage } from "@jabberwock/types"
import { t } from "../../../i18n"
import * as vscode from "vscode"
import { postStateToWebview } from "../../foundation/window-manager/store"
import { getMstState } from "../../foundation/mst/store"
import { upsertProviderProfile, activateProviderProfile, deleteProviderProfile } from "./store"

export type HandlerFn = (provider: EventBridge, message: WebviewMessage) => Promise<void>

export const handlerMap: Record<string, HandlerFn> = {
	saveApiConfiguration: async (provider, message) => {
		if (message.text && message.apiConfiguration) {
			try {
				await provider.providerSettingsManager!.saveConfig(message.text, message.apiConfiguration)
				const listApiConfig = await provider.providerSettingsManager!.listConfig()
				await provider.updateGlobalState("listApiConfigMeta", listApiConfig)
			} catch (error) {
				provider.log(
					`Error save api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
				)
				vscode.window.showErrorMessage(t("common:errors.save_api_config"))
			}
		}
	},

	upsertApiConfiguration: async (provider, message) => {
		if (message.text && message.apiConfiguration) {
			console.log(
				`[handlers/upsertApiConfiguration] START: name="${message.text}", apiProvider="${message.apiConfiguration.apiProvider}", apiModelId="${message.apiConfiguration.apiModelId}"`,
			)
			console.log(
				`[handlers/upsertApiConfiguration] providerSettingsManager exists:`,
				!!provider.providerSettingsManager,
			)
			try {
				const result = await upsertProviderProfile(provider, message.text, message.apiConfiguration, true)

				console.log(`[handlers/upsertApiConfiguration] upsertProviderProfile returned:`, result)

				if (!provider.providerSettingsManager) {
					console.log(
						`[handlers/upsertApiConfiguration] ERROR: providerSettingsManager is undefined - config will NOT be persisted!`,
					)
					vscode.window.showErrorMessage("API config persistence not available. Please reload VS Code.")
					return
				}

				const listApiConfig = await provider.providerSettingsManager.listConfig()
				console.log(
					`[handlers/upsertApiConfiguration] listConfig returned ${listApiConfig?.length ?? 0} configs`,
				)

				await provider.updateGlobalState("listApiConfigMeta", listApiConfig)
				await provider.updateGlobalState("currentApiConfigName", message.text)
				console.log(
					`[handlers/upsertApiConfiguration] saved currentApiConfigName="${message.text}" to global state`,
				)

				// Pass the saved apiConfiguration back to the webview so it can
				// synchronize its state with the persisted configuration.
				await postStateToWebview(provider, { apiConfiguration: message.apiConfiguration })
				console.log(`[handlers/upsertApiConfiguration] DONE: posted state to webview`)
			} catch (error) {
				console.log(
					`[handlers/upsertApiConfiguration] ERROR: ${error instanceof Error ? error.message : String(error)}`,
				)
				provider.log(
					`Error create new api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
				)
				vscode.window.showErrorMessage(t("common:errors.save_api_config"))
			}
		}
	},

	renameApiConfiguration: async (provider, message) => {
		if (message.values && message.apiConfiguration) {
			try {
				const values = message.values as Record<string, unknown>
				const oldName = values.oldName as string
				const newName = values.newName as string

				if (oldName === newName) {
					return
				}

				const { id } = await provider.providerSettingsManager!.getProfile({ name: oldName })
				await provider.providerSettingsManager!.saveConfig(newName, { ...message.apiConfiguration, id })
				await provider.providerSettingsManager!.deleteConfig(oldName)

				await activateProviderProfile(provider, { name: newName })
			} catch (error) {
				provider.log(
					`Error rename api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
				)
				vscode.window.showErrorMessage(t("common:errors.rename_api_config"))
			}
		}
	},

	deleteApiConfiguration: async (provider, message) => {
		if (message.text) {
			const answer = await vscode.window.showInformationMessage(
				t("common:confirmation.delete_config_profile"),
				{ modal: true },
				t("common:answers.yes"),
			)

			if (answer !== t("common:answers.yes")) {
				return
			}

			const oldName = message.text
			const newName = (await provider.providerSettingsManager!.listConfig()).filter((c) => c.name !== oldName)[0]
				?.name

			if (!newName) {
				vscode.window.showErrorMessage(t("common:errors.delete_api_config"))
				return
			}

			try {
				await provider.providerSettingsManager!.deleteConfig(oldName)
				await activateProviderProfile(provider, { name: newName })
			} catch (error) {
				provider.log(
					`Error delete api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
				)
				vscode.window.showErrorMessage(t("common:errors.delete_api_config"))
			}
		}
	},

	loadApiConfiguration: async (provider, message) => {
		if (message.text) {
			try {
				const profile = await activateProviderProfile(provider, { name: message.text })
				if (profile) {
					await provider.updateGlobalState("currentApiConfigName", message.text)
				}
				await postStateToWebview(provider)
			} catch (error) {
				provider.log(
					`Error load api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
				)
				vscode.window.showErrorMessage(t("common:errors.load_api_config"))
			}
		}
	},

	loadApiConfigurationById: async (provider, message) => {
		if (message.text) {
			try {
				const profile = await activateProviderProfile(provider, { id: message.text })
				if (profile) {
					const configName = typeof profile.name === "string" ? profile.name : undefined
					await provider.updateGlobalState("currentApiConfigName", configName)
				}
				await postStateToWebview(provider)
			} catch (error) {
				provider.log(
					`Error load api configuration by ID: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
				)
				vscode.window.showErrorMessage(t("common:errors.load_api_config"))
			}
		}
	},

	getListApiConfiguration: async (provider, _message) => {
		try {
			const listApiConfig = await provider.providerSettingsManager!.listConfig()
			await provider.updateGlobalState("listApiConfigMeta", listApiConfig)
			provider.postMessageToWebview({ type: "listApiConfig", listApiConfig })
			getMstState(provider).listApiConfigStore?.setListApiConfig(listApiConfig)
		} catch (error) {
			provider.log(
				`Error get list api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
			)
			vscode.window.showErrorMessage(t("common:errors.list_api_config"))
		}
	},

	lockApiConfigAcrossModes: async (provider, message) => {
		const enabled = message.bool ?? false
		await provider.context.workspaceState.update("lockApiConfigAcrossModes", enabled)
		await postStateToWebview(provider)
	},

	toggleApiConfigPin: async (provider, message) => {
		if (message.text) {
			const currentPinned = provider.contextProxy.getGlobalState("pinnedApiConfigs") ?? {}
			const updatedPinned: Record<string, boolean> = { ...currentPinned }

			if (currentPinned[message.text]) {
				delete updatedPinned[message.text]
			} else {
				updatedPinned[message.text] = true
			}

			await provider.updateGlobalState("pinnedApiConfigs", updatedPinned)
			await postStateToWebview(provider)
		}
	},

	enhancementApiConfigId: async (provider, message) => {
		await provider.updateGlobalState("enhancementApiConfigId", message.text)
		await postStateToWebview(provider)
	},

	setApiConfigPassword: async (_provider, _message) => {
		// No-op or future implementation
	},
}
