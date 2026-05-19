import type { EventBridge } from "../../../core/webview/EventBridge"
import type {
	ClineMessage,
	HistoryItem,
	ProviderSettingsEntry,
	ProviderNameWithRetired,
	WebviewMessage,
} from "@jabberwock/types"
import { getTheme } from "../../../integrations/theme/getTheme"
import { checkExistKey } from "../../../shared/checkExistApiConfig"
import { TelemetryService } from "@jabberwock/telemetry"
import * as vscode from "vscode"
import { resolveImageMentions } from "../../../core/mentions/resolveImageMentions"
import { CloudService, getCloudService, hasCloudService } from "@jabberwock/cloud"

import { postStateToWebview } from "../../foundation/window-manager/store"
import { getHistoryState } from "../../history/store"
export type HandlerFn = (provider: EventBridge, message: WebviewMessage) => Promise<void>

import { createTask } from "../task/actions/startTask"
import { activateProviderProfile } from "../../settings/api-config/store"
import { getWorkspaceTracker } from "../../foundation/window-manager/store"
export const handlerMap: Record<string, HandlerFn> = {
	newTask: async (provider, message) => {
		try {
			const currentCline = provider.getCurrentTask()
			const cwd = currentCline?.cwd || provider.cwd
			const text = message.text ?? ""
			const images = message.images
			const currentTask = provider.getCurrentTask()
			const state = await provider.getState()
			const { resolveImageMentions } = await import("../../../core/mentions/resolveImageMentions")
			const resolved = await resolveImageMentions({
				text,
				images,
				cwd,
				jabberwockIgnoreController: currentTask?.jabberwockIgnoreController,
				maxImageFileSize: state.maxImageFileSize,
				maxTotalImageSize: state.maxTotalImageSize,
			})
			const task = await createTask(
				provider,
				resolved.text,
				resolved.images,
				{ taskId: message.taskId },
				message.taskConfiguration,
			)
			await provider.postMessageToWebview({ type: "invoke", invoke: "newChat" })

			// Push task state to the webview so it transitions from HomeScreen to
			// ChatArea. Without this, cancelTask/clearTask clear the webview state
			// but newTask never pushes any — the webview remains on HomeScreen with
			// currentTaskItem still null/undefined even though the Task was created.
			if (task && task.clineMessages) {
				await postStateToWebview(provider, {
					clineMessages: task.clineMessages,
					currentTaskItem: {
						id: task.taskId,
						ts: task.clineMessages[0]?.ts ?? Date.now(),
						task: task.metadata?.task ?? resolved.text,
					},
				} as Record<string, unknown>)
			}
		} catch (error) {
			await provider.postMessageToWebview({ type: "invoke", invoke: "newChat" })
			console.error(
				`[extension] [jabberwock] [${new Date().toISOString()}] Failed to create task: ${error instanceof Error ? error.message : String(error)}`,
			)
			vscode.window.showErrorMessage(
				`Failed to create task: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	},

	cancelTask: async (provider, _message) => {
		provider.getCurrentTask()?.abortTask?.()
		await provider.postMessageToWebview({ type: "invoke", invoke: "newChat" })
		await postStateToWebview(provider, {
			clineMessages: [],
			currentTaskItem: undefined,
		} as Record<string, unknown>)
	},

	clearTask: async (provider, _message) => {
		provider.getCurrentTask()?.abortTask?.()
		await provider.postMessageToWebview({ type: "invoke", invoke: "newChat" })
		await postStateToWebview(provider, {
			clineMessages: [],
			currentTaskItem: undefined,
		} as Record<string, unknown>)
	},

	taskSyncEnabled: async (provider, message) => {
		const enabled = message.bool ?? false
		const updatedSettings = { taskSyncEnabled: enabled }
		try {
			const { CloudService } = await import("@jabberwock/cloud")
			await getCloudService().updateUserSettings(updatedSettings)
		} catch (error) {
			provider.log(`Failed to update cloud settings for task sync: ${error}`)
		}
	},

	condenseTaskContextRequest: async (provider, message) => {
		provider.getCurrentTask()?.condenseContext()
	},

	webviewDidLaunch: async (provider, _message) => {
		const customModes = await provider.customModesManager?.getCustomModes()
		await provider.updateGlobalState("customModes", customModes)

		// Load the current apiConfiguration from ProviderSettingsManager so that
		// postStateToWebview includes it. Otherwise the initial state (sent by
		// resolveWebviewView) would be overwritten with an empty {} state, causing
		// the webview to re-show the welcome screen.
		const additionalState: Record<string, unknown> = {}
		try {
			const { getBackendRootStore } = await import("../../storeSingleton")
			const store = getBackendRootStore()
			const apiConfig = store.settings.apiConfig

			if (apiConfig.apiProvider) {
				additionalState.apiConfiguration = apiConfig.toProviderSettings()
			}
			if (apiConfig.listApiConfigMeta) {
				additionalState.listApiConfigMeta = apiConfig.listApiConfigMeta
			}
		} catch (error) {
			console.error(
				`[extension] [jabberwock] [${new Date().toISOString()}] webviewDidLaunch: failed to load apiConfiguration:`,
				error,
			)
		}

		// Send initial task history to the webview so the Home screen and History view
		// display previously started chats. Previously, task history was never sent to
		// the webview — it only existed in the extension's in-memory state.
		try {
			const historyState = getHistoryState(provider)
			if (historyState?.items?.length) {
				provider.postMessageToWebview({ type: "taskHistoryUpdated", taskHistory: historyState.items })
			}
		} catch (error) {
			console.error(
				`[extension] [jabberwock] [${new Date().toISOString()}] webviewDidLaunch: failed to send task history:`,
				error,
			)
		}

		// Restore the current task's clineMessages and currentTaskItem from the MST
		// chatStore so the webview doesn't show HomeScreen after a reload. Without
		// this, the webview always starts with empty clineMessages and no active task.
		try {
			const activeNode = provider.chatStore?.activeNodeId
			if (activeNode) {
				const uiMessages = (activeNode.uiMessages ?? []) as ClineMessage[]
				if (uiMessages.length > 0) {
					const currentTaskItem: Partial<HistoryItem> = {
						id: activeNode.id,
						ts: uiMessages[0]?.ts ?? Date.now(),
						task: activeNode.title ?? "",
						mode: activeNode.mode ?? undefined,
					}
					await provider.postMessageToWebview({
						type: "state",
						state: { clineMessages: uiMessages, currentTaskItem },
					})
				}
			}
		} catch (error) {
			console.error(
				`[extension] [jabberwock] [${new Date().toISOString()}] webviewDidLaunch: failed to restore chat state:`,
				error,
			)
		}

		postStateToWebview(provider, Object.keys(additionalState).length > 0 ? additionalState : undefined)
		const workspaceTracker = await getWorkspaceTracker(provider)
		await workspaceTracker?.initializeFilePaths()

		getTheme().then((theme: Record<string, unknown>) =>
			provider.postMessageToWebview({ type: "theme", text: JSON.stringify(theme) }),
		)

		const mcpHub = await provider.getMcpHub()

		if (mcpHub) {
			const servers = mcpHub.getAllServers()
			provider.postMessageToWebview({ type: "mcpServers", mcpServers: servers })
			provider.mcpServersStore?.setServers(servers)
		}

		const psm = provider.providerSettingsManager
		if (psm) {
			psm?.listConfig().then(async (listApiConfig: ProviderSettingsEntry[]) => {
				if (!listApiConfig) {
					return
				}

				if (listApiConfig.length === 1) {
					if (!checkExistKey(listApiConfig[0])) {
						const { apiConfiguration } = await provider.getState()
						if (apiConfiguration && checkExistKey(apiConfiguration)) {
							await psm.saveConfig(listApiConfig[0].name ?? "default", apiConfiguration)
							listApiConfig[0].apiProvider = (apiConfiguration as Record<string, unknown>)
								.apiProvider as ProviderNameWithRetired
						}
					}
				}

				const currentConfigName = provider.contextProxy.getGlobalState("currentApiConfigName")

				if (currentConfigName) {
					if (!(await psm.hasConfig(currentConfigName))) {
						const name = listApiConfig[0]?.name
						await provider.updateGlobalState("currentApiConfigName", name)
						if (name) {
							await activateProviderProfile(provider, { name })
							return
						}
					}
				}

				await Promise.all([
					await provider.updateGlobalState("listApiConfigMeta", listApiConfig),
					await provider.postMessageToWebview({ type: "listApiConfig", listApiConfig }),
				])

				// Sync MST store with the now-activated profile
				try {
					const currentConfigName = provider.contextProxy.getGlobalState("currentApiConfigName")
					if (currentConfigName && psm) {
						const profile = await psm.getProfile({ name: currentConfigName })
						if (profile) {
							const { getBackendRootStore } = await import("../../storeSingleton")
							const store = getBackendRootStore()
							store.settings.apiConfig.setConfiguration(profile)
							store.settings.apiConfig.setCurrentConfigName(currentConfigName)
						}
					}
				} catch {
					// Non-critical
				}
			})
		}
	},
}
