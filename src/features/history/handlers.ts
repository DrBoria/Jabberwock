import type { EventBridge } from "../../core/webview/EventBridge"
import type { WebviewMessage } from "@jabberwock/types"
import { searchCommits } from "../../utils/git"
import { exportSettings, importSettingsWithFeedback } from "../../core/config/importExport"
import { t } from "../../i18n"
import * as vscode from "vscode"

import { postStateToWebview } from "../foundation/window-manager/store"
export type HandlerFn = (provider: EventBridge, message: WebviewMessage) => Promise<void>

export const handlerMap: Record<string, HandlerFn> = {
	searchCommits: async (provider, message) => {
		const currentCline = provider.getCurrentTask()
		const cwd = currentCline?.cwd || provider.cwd
		if (cwd) {
			try {
				const commits = await searchCommits(message.query || "", cwd)
				await provider.postMessageToWebview({
					type: "commitSearchResults",
					commits,
				})
			} catch (error) {
				provider.log(`Error searching commits: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`)
				vscode.window.showErrorMessage(t("common:errors.search_commits"))
			}
		}
	},

	importSettings: async (provider, _message) => {
		await importSettingsWithFeedback({
			providerSettingsManager: provider.providerSettingsManager!,
			contextProxy: provider.contextProxy,
			customModesManager: provider.customModesManager!,
			provider,
		})
	},

	exportSettings: async (provider, _message) => {
		await exportSettings({
			providerSettingsManager: provider.providerSettingsManager!,
			contextProxy: provider.contextProxy,
		})
	},

	resetState: async (provider, _message) => {
		const confirm = await vscode.window.showWarningMessage(
			t("common:confirm.reset_state"),
			{ modal: true },
			t("common:yes"),
		)
		if (confirm !== t("common:yes")) return

		// Abort current task if any
		provider.getCurrentTask()?.abortTask?.()

		// Clear the task stack
		provider.taskStack.splice(0, provider.taskStack.length)

		// Re-initialize all feature stores
		const { initHistoryState } = await import("../history")
		const { initFoundationState } = await import("../foundation")
		const { initChatState } = await import("../chat")
		const { initSettingsState } = await import("../settings")
		const { initCloudState } = await import("../cloud")
		const { initTelemetryState } = await import("../telemetry")
		const { initMarketplaceState } = await import("../marketplace")
		const { initDiagnosticsState } = await import("../diagnostics")

		await initHistoryState(provider, provider.contextProxy)
		await initFoundationState(provider)
		initChatState(provider)
		initSettingsState(provider)
		initCloudState(provider)
		initTelemetryState(provider)
		initMarketplaceState(provider)
		initDiagnosticsState(provider)

		// Post updated state to webview
		await postStateToWebview(provider)
	},

	historyButtonClicked: async (provider, _message) => {
		provider.postMessageToWebview({ type: "action", action: "historyButtonClicked" })
	},
}
