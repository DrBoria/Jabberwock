import type { GlobalState } from "@jabberwock/types"
import { log as backendLog } from "@features/foundation/capabilities/backend-logger"
import { IntentType } from "@jabberwock/types"
import { searchCommits } from "@utils/git"
import { exportSettings } from "@features/settings/actions/export"
import { importSettingsWithFeedback } from "@features/settings/actions/importSettings"
import { t } from "@i18n"
import { getSettingsAccess } from "@utils/settings"
import { getUiDialogs } from "@features/foundation/capabilities/registry"
import { getHostEnvironment } from "@features/foundation/host-context/context"
import { getProviderSettingsManager } from "@features/settings/models/provider-settings-manager/ProviderSettingsManager"

import type { IntentBus } from "@features/intents/bus"
import { postStateToWebview } from "@features/foundation/window-manager/store"
import { initHistoryState } from "@features/hist"
import { initFoundationState } from "@features/foundation"
import { initChatState } from "@features/chat"
import { initSettingsState } from "@features/settings"
import { initCloudState } from "@features/cloud"
import { initMarketplaceState } from "@features/marketplace"

/**
 * Register all history-related intent handlers on the bus.
 */
export function registerOnHistory(bus: IntentBus): void {
	bus.register(IntentType.HistoryCommitsSearch, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { query?: string }
		const currentCline = ctx.rootStore.chat.activeTask
		const cwd = currentCline?.cwd
		if (cwd) {
			try {
				const commits = await searchCommits(payload.query || "", cwd)
				await provider.postMessageToWebview({
					type: "commitSearchResults",
					commits,
				})
			} catch (error) {
				backendLog.info(
					`Error searching commits: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
				)
				publishNotificationError(t("common:errors.search_commits"))
			}
		}
	})

	bus.register(IntentType.HistorySettingsImport, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		await importSettingsWithFeedback({
			providerSettingsManager: getProviderSettingsManager()!,
			contextProxy: getSettingsAccess(),

			provider,
		})
	})

	bus.register(IntentType.HistorySettingsExport, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		await exportSettings({
			providerSettingsManager: getProviderSettingsManager()!,
			contextProxy: getSettingsAccess(),
		})
	})

	bus.register(IntentType.HistoryStateReset, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		// D4g-2 (batch 1): modal confirmation through the uiDialogs capability slot instead of a
		// direct "vscode" import (plan section 3.2 Strategy C).
		const confirm = await getUiDialogs().showConfirmDialog({
			message: t("common:confirm.reset_state"),
			modal: true,
			buttons: [t("common:yes")],
		})
		if (confirm !== t("common:yes")) return

		// Abort current task if any
		ctx.rootStore.chat.activeTask?.abortTask?.()

		// Clear the task stack
		ctx.rootStore.chat.clear()

		// Re-initialize all feature stores
		await initHistoryState(provider, {
			getGlobalState: (key: string) => getHostEnvironment().getGlobalState(key as keyof GlobalState),
		})
		await initFoundationState(provider)
		initChatState(provider)
		initSettingsState(provider)
		initCloudState(provider)
		initMarketplaceState(provider)

		// Post updated state to webview
		await postStateToWebview(provider)
	})

	bus.register(IntentType.HistoryButtonClicked, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		provider.postMessageToWebview({ type: "action", action: "historyButtonClicked" })
	})
}

import { publishNotificationError } from "@features/foundation/capabilities/notifications"
