import type { IntentBus } from "../../../intents/bus"
import { IntentConstants } from "@intentConstants"
import type { IntentHandlerContext } from "../../../intents/context"
import { getRootStore } from "../../../root-store"
import type { IRootStore } from "../../../root-store"
import { checkExistKey } from "@shared/api/checkExistApiConfig"
import { getConnectorBus } from "../../../../connector-bus"
import { eventConstants } from "@jabberwock/types"
import type { Command, ExtensionState, MarketplaceInstalledMetadata } from "@jabberwock/types"

// ── Type guards ─────────────────────────────────────────────────────

function hasStateInPayload(payload: Record<string, unknown>): payload is { state?: Partial<ExtensionState> } {
	return typeof payload === "object" && payload !== null
}

function hasUriInPayload(payload: Record<string, unknown>): payload is { uri?: string } {
	return typeof payload === "object" && payload !== null
}

function hasWorkspaceInPayload(payload: Record<string, unknown>): payload is {
	filePaths?: string[]
	openedTabs?: Array<{ label: string; isActive: boolean; path?: string }>
	uri?: string
} {
	return typeof payload === "object" && payload !== null
}

function hasCommandsInPayload(payload: Record<string, unknown>): payload is { commands?: Command[] } {
	return typeof payload === "object" && payload !== null
}

function hasActionInPayload(payload: Record<string, unknown>): payload is { action?: string } {
	return typeof payload === "object" && payload !== null
}

// ── Domain routing helpers (STATE_RECEIVED) ─────────────────────────

function handleWelcomeState(store: IRootStore, newState: Partial<ExtensionState>, hasApiConfig: boolean): void {
	if (!store._welcomeDismissed && hasApiConfig) {
		const showWelcomeValue = !checkExistKey(newState.apiConfiguration)
		store.setShowWelcome(showWelcomeValue)
	}
}

function routeToSettingsStoreSimple(store: IRootStore, newState: Partial<ExtensionState>): void {
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
}

function routeToSettingsStoreComplex(store: IRootStore, newState: Partial<ExtensionState>): void {
	if (newState.hasOpenedModeSelector !== undefined) {
		store.settings.setHasOpenedModeSelector(newState.hasOpenedModeSelector)
	}
	if (newState.profileThresholds !== undefined) {
		store.settings.setProfileThresholds(newState.profileThresholds)
	}
	if (newState.mcpServers !== undefined) {
		store.settings.setMcpServers(newState.mcpServers)
	}
	if (newState.routerModels !== undefined) {
		store.settings.setRouterModels(newState.routerModels)
	}
	if (newState.organizationAllowList !== undefined) {
		store.settings.setOrganizationAllowList(newState.organizationAllowList)
	}
	if (newState.organizationSettingsVersion !== undefined) {
		store.settings.setOrganizationSettingsVersion(newState.organizationSettingsVersion)
	}
}

function isMarketplaceInstalledData(value: unknown): value is MarketplaceInstalledMetadata {
	return typeof value === "object" && value !== null
}

function routeToMarketplaceStore(store: IRootStore, newState: Partial<ExtensionState>): void {
	if (newState.marketplaceItems !== undefined) {
		const installedMetadata = newState.marketplaceInstalledMetadata
		store.marketplace.setMarketplaceData(
			newState.marketplaceItems,
			isMarketplaceInstalledData(installedMetadata) ? installedMetadata : undefined,
		)
	}
	if (newState.skills !== undefined) {
		store.marketplace.setSkills(newState.skills)
	}
}

function routeToCloudStore(store: IRootStore, newState: Partial<ExtensionState>): void {
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
}

function routeLocatorTarget(store: IRootStore, newState: Partial<ExtensionState>): void {
	if (newState.locatorTarget !== undefined) {
		store.extensionState = { ...store.extensionState, locatorTarget: newState.locatorTarget }
	}
}

// ── Handler implementations (extracted from bus.register callbacks) ─

async function handleStateReceived(
	intent: { id: string; type: string; payload: Record<string, unknown> },
	_ctx: IntentHandlerContext,
): Promise<void> {
	if (!hasStateInPayload(intent.payload)) {
		return
	}

	const store = getRootStore()
	const newState = intent.payload.state ?? {}
	const hasApiConfig = "apiConfiguration" in newState

	store.mergeExtensionState(newState)
	handleWelcomeState(store, newState, hasApiConfig)
	store.didHydrateState = true

	routeToSettingsStoreSimple(store, newState)
	routeToSettingsStoreComplex(store, newState)
	routeLocatorTarget(store, newState)
	routeToMarketplaceStore(store, newState)
	routeToCloudStore(store, newState)
}

async function handleShowInteractiveApp(
	intent: { id: string; type: string; payload: Record<string, unknown> },
	_ctx: IntentHandlerContext,
): Promise<void> {
	if (!hasUriInPayload(intent.payload)) {
		return
	}

	const store = getRootStore()
	store.interactiveAppUri = intent.payload.uri ?? ""
}

async function handleWorkspaceUpdated(
	intent: { id: string; type: string; payload: Record<string, unknown> },
	_ctx: IntentHandlerContext,
): Promise<void> {
	if (!hasWorkspaceInPayload(intent.payload)) {
		return
	}

	const store = getRootStore()
	const payload = intent.payload
	store.filePaths = payload.filePaths ?? []
	store.openedTabs = payload.openedTabs ?? []
	if (payload.uri) {
		store.extensionState = { ...store.extensionState, cwd: payload.uri }
	}
}

async function handleCommandsUpdated(
	intent: { id: string; type: string; payload: Record<string, unknown> },
	_ctx: IntentHandlerContext,
): Promise<void> {
	if (!hasCommandsInPayload(intent.payload)) {
		return
	}

	const store = getRootStore()
	const rawCommands = intent.payload.commands
	store.extensionCommands = rawCommands ?? []
}

async function handleActionReceived(
	intent: { id: string; type: string; payload: Record<string, unknown> },
	_ctx: IntentHandlerContext,
): Promise<void> {
	if (!hasActionInPayload(intent.payload)) {
		return
	}

	const store = getRootStore()
	if (intent.payload.action === "toggleAutoApprove") {
		const newValue = !(store.extensionState.autoApprovalEnabled ?? false)
		store.extensionState = { ...store.extensionState, autoApprovalEnabled: newValue }
		getConnectorBus().publish({ type: eventConstants.AGENT_STATE.AUTO_APPROVAL_ENABLED, bool: newValue })
	}
}

// ── Registration entry point ───────────────────────────────────────

/**
 * Register all frontend foundation event handlers on the IntentBus.
 * Foundation sub-features (window-manager, agent-state, mst-bridge) register their own handlers.
 */
export function registerOnFrontendFoundationIntents(bus: IntentBus): void {
	bus.register(IntentConstants.task.STATE_RECEIVED, handleStateReceived)
	bus.register(IntentConstants.foundation.SHOW_INTERACTIVE_APP, handleShowInteractiveApp)
	bus.register(IntentConstants.foundation.WORKSPACE_UPDATED, handleWorkspaceUpdated)
	bus.register(IntentConstants.foundation.COMMANDS_UPDATED, handleCommandsUpdated)
	bus.register(IntentConstants.task.ACTION_RECEIVED, handleActionReceived)
}
