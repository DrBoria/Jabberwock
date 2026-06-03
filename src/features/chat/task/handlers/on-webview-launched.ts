import { IntentType } from "@jabberwock/types"
import type {
	Notification,
	HistoryItem,
	ProviderSettings,
	ProviderSettingsEntry,
	ProviderNameWithRetired,
} from "@jabberwock/types"
import type { IntentBus } from "../../../intents/bus"

import { getProviderSettingsManager } from "../../../settings/models/ProviderSettingsManager"
import { getMstState } from "../../../foundation/mst/store"
import { getVscodeContext } from "../../../foundation/vscode/context"
import { getHistoryState } from "../../../history/actions"
import { postStateToWebview, getWorkspaceTracker } from "@features/foundation/window-manager/store"
import { getTheme } from "../../../../integrations/theme/getTheme"
import { getMcpServerManager } from "../../../../services/mcp/McpServerManager"
import { checkExistKey } from "../../../../shared/checkExistApiConfig"
import { activateProviderProfile } from "../../../settings/models/api-config-store"

/**
 * Handles task.webview.launched intent — initializes webview state on launch.
 *
 * This handler runs when the webview first loads. It restores persisted state,
 * loads configuration (API, modes, MCP), and pushes initial state to the webview.
 */
export function registerOnTaskWebviewLaunched(bus: IntentBus): void {
	bus.register(IntentType.TaskWebviewLaunched, async (_intent, ctx) => {
		const provider = ctx.provider

		if (!provider) {
			return
		}

		// ── 1. Custom Modes ──────────────────────────────────────────
		const customModes = ctx.rootStore.settings.modes.customModes
		await getVscodeContext().updateGlobalState("customModes", customModes)

		// ── 2. API Configuration ─────────────────────────────────────
		// Load the current apiConfiguration from ProviderSettingsManager so that
		// postStateToWebview includes it. Otherwise the initial state (sent by
		// resolveWebviewView) would be overwritten with an empty {} state, causing
		// the webview to re-show the welcome screen.
		const additionalState: { [key: string]: unknown } = {}
		try {
			const store = ctx.rootStore
			const apiConfig = store.settings.apiConfig

			if (apiConfig.apiProvider) {
				additionalState.apiConfiguration = apiConfig.toProviderSettings()
			}
			if (apiConfig.listApiConfigMeta) {
				additionalState.listApiConfigMeta = apiConfig.listApiConfigMeta
			}
		} catch (error: unknown) {
			console.error(
				`[jabberwock] [${new Date().toISOString()}] webviewDidLaunch: failed to load apiConfiguration:`,
				error,
			)
		}

		// ── 3. Task History ──────────────────────────────────────────
		// Send initial task history to the webview so the Home screen and History view
		// display previously started chats.
		try {
			const historyState = getHistoryState(ctx.rootStore)
			if (historyState?.items?.length) {
				provider.postMessageToWebview({ type: "taskHistoryUpdated", taskHistory: historyState.items })
			}
		} catch (error: unknown) {
			console.error(
				`[jabberwock] [${new Date().toISOString()}] webviewDidLaunch: failed to send task history:`,
				error,
			)
		}

		// ── 4. Restore Chat State from MST ───────────────────────────
		// Restore the current task's messages and currentTaskItem from the MST
		// store so the webview doesn't show HomeScreen after a reload.
		try {
			const activeTask = ctx.rootStore.chat.activeTask
			if (activeTask) {
				const uiMessages = activeTask.messages ?? []
				if (uiMessages.length > 0) {
					const currentTaskItem: Partial<HistoryItem> = {
						id: activeTask.taskId,
						ts: uiMessages[0]?.ts ?? Date.now(),
						task: activeTask.taskId,
						mode: activeTask._taskMode ?? undefined,
					}
					await provider.postMessageToWebview({
						type: "state",
						state: { messages: uiMessages, currentTaskItem },
					})
				}
			}
		} catch (error: unknown) {
			console.error(
				`[jabberwock] [${new Date().toISOString()}] webviewDidLaunch: failed to restore chat state:`,
				error,
			)
		}

		// ── 5. Post State to Webview ─────────────────────────────────
		postStateToWebview(provider, Object.keys(additionalState).length > 0 ? additionalState : undefined)

		// ── 6. Workspace Tracker ─────────────────────────────────────
		try {
			const workspaceTracker = await getWorkspaceTracker(provider)
			await workspaceTracker?.initializeFilePaths()
		} catch (error: unknown) {
			console.error(
				`[jabberwock] [${new Date().toISOString()}] webviewDidLaunch: failed to initialize workspace tracker:`,
				error,
			)
		}

		// ── 7. Theme ─────────────────────────────────────────────────
		getTheme().then((theme: { [key: string]: unknown }) =>
			provider.postMessageToWebview({ type: "theme", text: JSON.stringify(theme) }),
		)

		// ── 8. MCP Servers ───────────────────────────────────────────
		const mcpHub = getMcpServerManager().getMcpHub()

		if (mcpHub) {
			const servers = mcpHub.getAllServers()
			void provider.postMessageToWebview({ type: "mcpServers", mcpServers: servers })
			const mstState = getMstState(ctx.rootStore)
			mstState.mcpServersStore?.setServers(servers)
		}

		// ── 9. API Config Profile Management ─────────────────────────
		const psm = getProviderSettingsManager()
		if (psm) {
			psm?.listConfig().then(async (listApiConfig: ProviderSettingsEntry[]) => {
				if (!listApiConfig) {
					return
				}

				if (listApiConfig.length === 1) {
					if (!checkExistKey(listApiConfig[0])) {
						const apiConfiguration = ctx.rootStore.settings.apiConfig.toProviderSettings() as
							| ProviderSettings
							| undefined
						if (apiConfiguration && checkExistKey(apiConfiguration)) {
							await psm.saveConfig(listApiConfig[0].name ?? "default", apiConfiguration)
							listApiConfig[0].apiProvider = (apiConfiguration as { [key: string]: unknown })
								.apiProvider as ProviderNameWithRetired
						}
					}
				}

				const currentConfigName = getVscodeContext().getGlobalState("currentApiConfigName")

				if (currentConfigName) {
					if (!(await psm.hasConfig(currentConfigName))) {
						const name = listApiConfig[0]?.name
						await getVscodeContext().updateGlobalState("currentApiConfigName", name)
						if (name) {
							await activateProviderProfile(provider, { name })
							return
						}
					}
				}

				await Promise.all([
					await getVscodeContext().updateGlobalState("listApiConfigMeta", listApiConfig),
					await provider.postMessageToWebview({ type: "listApiConfig", listApiConfig }),
				])

				// Sync MST store with the now-activated profile
				try {
					const currentConfigName = getVscodeContext().getGlobalState("currentApiConfigName")
					if (currentConfigName && psm) {
						const profile = await psm.getProfile({ name: currentConfigName })
						if (profile) {
							ctx.rootStore.settings.apiConfig.setConfiguration(profile)
							ctx.rootStore.settings.apiConfig.setCurrentConfigName(currentConfigName)
						}
					}
				} catch (error: unknown) {
					// Non-critical
				}
			})
		}
	})
}
