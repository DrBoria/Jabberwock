import type { GlobalState } from "@jabberwock/types"
import type { IntentBus } from "@features/intents"
import { log as backendLog } from "@features/foundation"

import { IntentType } from "@jabberwock/types"

import { searchCommits } from "@utils/git"

import { exportSettings } from "@features/settings"

import { importSettingsWithFeedback } from "@features/settings"

import { sendCommitSearchResults, sendHistoryButtonClicked } from "@features/settings"

import { t } from "@i18n"

import { getSettingsAccess } from "@utils/settings"

import { getUiDialogs } from "@features/foundation"

import { getHostEnvironment } from "@features/foundation"

import { getProviderSettingsManager } from "@features/settings/models/provider-settings-manager"

import { postStateToWebview } from "@features/foundation"

import { initHistoryState } from "@features/hist/actions"

import { initFoundationState } from "@features/foundation"

import { initSettingsState } from "@features/settings"

import { initCloudState } from "@features/cloud"

import { initMarketplaceState } from "@features/marketplace"

import { publishNotificationError } from "@features/foundation"

/**
 * Register all history-related intent handlers on the bus.
 */

function registerOnHistoryHistoryCommitsSearch(bus: IntentBus): void {
	bus.register(IntentType.HistoryCommitsSearch, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { query?: string }
		const currentCline = ctx.rootStore.chat.activeTask
		const cwd = currentCline?.cwd
		if (cwd) {
			try {
				const commits = await searchCommits(payload.query || "", cwd)
				await sendCommitSearchResults(provider, commits)
			} catch (error) {
				backendLog.info(
					`Error searching commits: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
				)
				publishNotificationError(t("common:errors.search_commits"))
			}
		}
	})
}

function registerOnHistoryHistorySettingsImport(bus: IntentBus): void {
	bus.register(IntentType.HistorySettingsImport, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		await importSettingsWithFeedback({
			providerSettingsManager: getProviderSettingsManager()!,
			contextProxy: getSettingsAccess(),

			provider,
		})
	})
}

function registerOnHistoryHistorySettingsExport(bus: IntentBus): void {
	bus.register(IntentType.HistorySettingsExport, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		await exportSettings({
			providerSettingsManager: getProviderSettingsManager()!,
			contextProxy: getSettingsAccess(),
		})
	})
}

function registerOnHistoryHistoryStateReset(bus: IntentBus): void {
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
		initSettingsState(provider)
		initCloudState(provider)
		initMarketplaceState(provider)

		// Post updated state to webview
		await postStateToWebview(provider)
	})
}

function registerOnHistoryHistoryButtonClicked(bus: IntentBus): void {
	bus.register(IntentType.HistoryButtonClicked, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		sendHistoryButtonClicked(provider)
	})
}

export function registerOnHistory(_bus: IntentBus): void {
	registerOnHistoryHistoryCommitsSearch(_bus)
	registerOnHistoryHistorySettingsImport(_bus)
	registerOnHistoryHistorySettingsExport(_bus)
	registerOnHistoryHistoryStateReset(_bus)
	registerOnHistoryHistoryButtonClicked(_bus)
}
