import type { IntentBus } from "../../../intents/bus"
import { IntentConstants } from "@intentConstants"
import type { IntentHandlerContext } from "../../../intents/context"
import { getRootStore } from "../../../root-store"
import { checkExistKey } from "@shared/checkExistApiConfig"
import { vscode } from "@jabberwock/devtool/webview"
import { eventConstants } from "@jabberwock/types"
import type {
	Command,
	ExtensionState,
	RouterModels,
	McpServer,
	SkillMetadata,
	MarketplaceItem,
	OrganizationAllowList,
	ProfileThresholds,
} from "@jabberwock/types"

/**
 * Register all frontend foundation event handlers on the IntentBus.
 * Foundation sub-features (window-manager, agent-state, mst-bridge) register their own handlers.
 */
export function registerOnFrontendFoundationIntents(bus: IntentBus): void {
	// ── STATE_RECEIVED: Full extension state hydration ──────────────────
	bus.register(IntentConstants.task.STATE_RECEIVED, async (intent, _ctx: IntentHandlerContext) => {
		const store = getRootStore()
		const payload = intent.payload as { state?: Partial<ExtensionState> }
		const newState = payload.state ?? {}
		const hasApiConfig = "apiConfiguration" in newState

		store.mergeExtensionState(newState)

		if (!store._welcomeDismissed && hasApiConfig) {
			const showWelcomeValue = !checkExistKey(newState.apiConfiguration)
			store.setShowWelcome(showWelcomeValue)
		}
		store.didHydrateState = true

		// Route state fields to SettingsStore
		if (newState.alwaysAllowFollowupQuestions !== undefined) {
			store.settings.setAlwaysAllowFollowupQuestions(newState.alwaysAllowFollowupQuestions)
		}
		if (newState.followupAutoApproveTimeoutMs !== undefined) {
			store.settings.setFollowupAutoApproveTimeoutMs(newState.followupAutoApproveTimeoutMs)
		}
		if (newState.includeTaskHistoryInEnhance !== undefined) {
			store.settings.setIncludeTaskHistoryInEnhance(newState.includeTaskHistoryInEnhance)
		}
		if (newState.includeCurrentTime !== undefined) {
			store.settings.setIncludeCurrentTime(newState.includeCurrentTime)
		}
		if (newState.includeCurrentCost !== undefined) {
			store.settings.setIncludeCurrentCost(newState.includeCurrentCost)
		}
		if (newState.hasOpenedModeSelector !== undefined) {
			store.settings.setHasOpenedModeSelector(newState.hasOpenedModeSelector)
		}
		if (newState.profileThresholds !== undefined) {
			store.settings.setProfileThresholds(newState.profileThresholds as ProfileThresholds)
		}
		if (newState.mcpServers !== undefined) {
			store.settings.setMcpServers(newState.mcpServers as McpServer[])
		}
		if (newState.routerModels !== undefined) {
			store.settings.setRouterModels(newState.routerModels as RouterModels)
		}
		if (newState.organizationAllowList !== undefined) {
			store.settings.setOrganizationAllowList(newState.organizationAllowList as OrganizationAllowList)
		}
		if (newState.organizationSettingsVersion !== undefined) {
			store.settings.setOrganizationSettingsVersion(newState.organizationSettingsVersion)
		}

		// Route locatorTarget on extensionState
		if (newState.locatorTarget !== undefined) {
			store.extensionState = { ...store.extensionState, locatorTarget: newState.locatorTarget }
		}

		// Route state fields to MarketplaceStore
		if (newState.marketplaceItems !== undefined) {
			store.marketplace.setMarketplaceData(
				newState.marketplaceItems as MarketplaceItem[],
				newState.marketplaceInstalledMetadata as MarketplaceInstalledMetadata | undefined,
			)
		}
		if (newState.skills !== undefined) {
			store.marketplace.setSkills(newState.skills as SkillMetadata[])
		}

		// Route state fields to CloudStore
		if (newState.cloudIsAuthenticated !== undefined) {
			store.cloud.setCloudIsAuthenticated(newState.cloudIsAuthenticated)
		}
		if (newState.cloudOrganizations !== undefined) {
			store.cloud.setCloudOrganizations(newState.cloudOrganizations)
		}
		if (newState.sharingEnabled !== undefined) {
			store.cloud.setSharingEnabled(newState.sharingEnabled)
		}
		if (newState.publicSharingEnabled !== undefined) {
			store.cloud.setPublicSharingEnabled(newState.publicSharingEnabled)
		}
	})

	bus.register(IntentConstants.foundation.SHOW_INTERACTIVE_APP, async (intent, _ctx: IntentHandlerContext) => {
		const store = getRootStore()
		store.interactiveAppUri = (intent.payload as { uri?: string }).uri ?? ""
	})

	bus.register(IntentConstants.foundation.WORKSPACE_UPDATED, async (intent, _ctx: IntentHandlerContext) => {
		const store = getRootStore()
		const payload = intent.payload as {
			filePaths?: string[]
			openedTabs?: Array<{ label: string; isActive: boolean; path?: string }>
			uri?: string
		}
		store.filePaths = payload.filePaths ?? []
		store.openedTabs = payload.openedTabs ?? []
		if (payload.uri) {
			store.extensionState = { ...store.extensionState, cwd: payload.uri }
		}
	})

	bus.register(IntentConstants.foundation.COMMANDS_UPDATED, async (intent, _ctx: IntentHandlerContext) => {
		const store = getRootStore()
		const payload = intent.payload as { commands?: unknown[] }
		store.extensionCommands = (payload.commands ?? []) as Command[]
	})

	// ── ACTION_RECEIVED: UI actions from the backend ─────────────────────
	bus.register(IntentConstants.task.ACTION_RECEIVED, async (intent, _ctx: IntentHandlerContext) => {
		const store = getRootStore()
		const payload = intent.payload as { action?: string }
		if (payload.action === "toggleAutoApprove") {
			const newValue = !(store.extensionState.autoApprovalEnabled ?? false)
			store.extensionState = { ...store.extensionState, autoApprovalEnabled: newValue }
			vscode.postMessage({ type: eventConstants.AGENT_STATE.AUTO_APPROVAL_ENABLED, bool: newValue })
		}
	})
}
