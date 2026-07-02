import * as vscode from "vscode"
import type { CommandId } from "@jabberwock/types"
import { getTelemetryService } from "@jabberwock/telemetry"

import { EventBridge } from "@features/foundation/webview/EventBridge"
import { getProviderSettingsManager } from "@features/settings/models/provider-settings-manager/ProviderSettingsManager"
import { getSettingsAccess } from "@utils/settings"
import { focusPanel } from "@utils/ui"
import { importSettingsWithFeedback } from "@features/settings/actions/importSettings"
import { handleNewChat } from "@activate/handleTask"
import { promptForCustomStoragePath } from "@utils/io"
import { getVisibleProviderOrLog } from "./visible-provider"
import { openClineInNewTab } from "./open-in-new-tab"
import { getPanel, tabPanel, sidebarPanel } from "./panel-store"

export type RegisterCommandOptions = {
	context: vscode.ExtensionContext
	outputChannel: vscode.OutputChannel
	provider: EventBridge
}

export const getCommandsMap = ({
	context,
	outputChannel,
	provider,
}: RegisterCommandOptions): Record<CommandId, (...args: unknown[]) => unknown> => ({
	activationCompleted: () => {},
	cloudButtonClicked: async () => {
		const visibleProvider = await getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		getTelemetryService().captureTitleButtonClicked("cloud")

		visibleProvider.postMessageToWebview({ type: "action", action: "cloudButtonClicked" })
	},
	plusButtonClicked: async () => {
		const visibleProvider = await getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		getTelemetryService().captureTitleButtonClicked("plus")

		const vp = visibleProvider as { taskStack?: unknown[] }
		const taskStack = vp.taskStack
		if (taskStack && taskStack.length > 0) {
			taskStack.splice(0, taskStack.length)
		}
		await visibleProvider.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
		await visibleProvider.postMessageToWebview({ type: "invoke", invoke: "newChat" })
		await visibleProvider.postMessageToWebview({ type: "action", action: "focusInput" })
	},
	popoutButtonClicked: () => {
		getTelemetryService().captureTitleButtonClicked("popout")

		return openClineInNewTab({ context, outputChannel })
	},
	openInNewTab: () => openClineInNewTab({ context, outputChannel }),
	settingsButtonClicked: async () => {
		const visibleProvider = await getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		getTelemetryService().captureTitleButtonClicked("settings")

		visibleProvider.postMessageToWebview({ type: "action", action: "settingsButtonClicked" })
	},
	historyButtonClicked: async () => {
		const visibleProvider = await getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		getTelemetryService().captureTitleButtonClicked("history")

		visibleProvider.postMessageToWebview({ type: "action", action: "historyButtonClicked" })
	},
	marketplaceButtonClicked: async () => {
		const visibleProvider = await getVisibleProviderOrLog(outputChannel)
		if (!visibleProvider) return
		visibleProvider.postMessageToWebview({ type: "action", action: "marketplaceButtonClicked" })
	},
	newChat: (...args: unknown[]) => handleNewChat(args[0] as { prompt?: string } | null | undefined),
	setCustomStoragePath: async () => {
		await promptForCustomStoragePath()
	},
	importSettings: async (...args: unknown[]) => {
		const filePath = args[0] as string | undefined
		const visibleProvider = await getVisibleProviderOrLog(outputChannel)
		if (!visibleProvider) {
			return
		}

		await importSettingsWithFeedback(
			{
				providerSettingsManager: getProviderSettingsManager()!,
				contextProxy: getSettingsAccess(),

				provider: visibleProvider,
			},
			filePath,
		)
	},
	focusInput: async () => {
		try {
			await focusPanel(tabPanel, sidebarPanel)

			if (sidebarPanel && getPanel() === sidebarPanel) {
				provider.postMessageToWebview({ type: "action", action: "focusInput" })
			}
		} catch (error) {
			outputChannel.appendLine(`Error focusing input: ${error}`)
		}
	},
	focusPanel: async () => {
		try {
			await focusPanel(tabPanel, sidebarPanel)
		} catch (error) {
			outputChannel.appendLine(`Error focusing panel: ${error}`)
		}
	},
	acceptInput: async () => {
		const visibleProvider = await getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		visibleProvider.postMessageToWebview({ type: "acceptInput" })
	},
	toggleAutoApprove: async () => {
		const visibleProvider = await getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		visibleProvider.postMessageToWebview({
			type: "action",
			action: "toggleAutoApprove",
		})
	},
})
