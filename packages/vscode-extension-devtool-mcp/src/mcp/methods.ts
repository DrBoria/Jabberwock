import type { BackendStore, FrontendBridge, StoreEnv } from "../types.js"
import type { DevtoolBridgeProvider } from "./server.js"
import { resolveConfig, type DevtoolConfig } from "./config.js"
import { registerGlobalErrorHandlers } from "./dom-query.js"
import { buildDomMethods } from "./dom-methods.js"
import { handleGetConsole, handleSearchConsole } from "../backend/console-handlers.js"
import { buildInfoMethods } from "../backend/info.js"
import { getStoreState, type GetStoreStateParams } from "../stores/mobx/snapshot/state.js"
import { searchBackendState, searchFrontendState, type SearchParams } from "../stores/mobx/search.js"
import {
	getStoreActions,
	filterActions,
	searchActions,
	countActions,
	getStoreActionsLog,
	getFrontendStoreActions,
	filterFrontendActions,
	searchFrontendActions,
	countFrontendActions,
	getFrontendStoreActionsLog,
	type ActionParams,
	type FilterActionParams,
	type SearchActionParams,
	type ActionLogParams,
} from "../stores/mobx/actions.js"
import type { SnapshotFilters } from "../backend/profiler/types.js"
import { diagnosticsManager } from "../backend/profiler/managers/DiagnosticsManager.js"
import { formatLogLine, tailReversed } from "../utils/log.js"

/**
 * The concrete set of devtool methods every domain tool calls into. It
 * replaces the former abstract "bridge" contract: built once by
 * {@link buildDevtoolMethods} from the host provider + config, the domain tool
 * selectors (backend / stores / frontend) register MCP tools that invoke these
 * methods directly.
 */
export interface DevtoolMethods {
	// backend: console
	getLogs(lines?: number): Promise<string>
	getDiagnosticsSnapshot(params?: Record<string, unknown>): Promise<string>
	clearDiagnostics(): Promise<string>
	getConsole(params: {
		env: "backend" | "frontend"
		level?: string
		limit?: number
		cursor?: number
		search?: string
	}): Promise<string>
	searchConsole(params: {
		env?: "backend" | "frontend"
		query: string
		level?: string
		limit?: number
		cursor?: number
	}): Promise<string>
	// backend: commands
	executeVscodeCommand(command: string, args?: unknown): Promise<string>
	// backend: info
	getExtensionInfo(): Promise<string>
	// stores
	getStoreState(params: GetStoreStateParams): Promise<string>
	searchState(params: SearchParams): Promise<string>
	getStoreActions(params: ActionParams): Promise<string>
	filterActions(params: FilterActionParams): Promise<string>
	searchActions(params: SearchActionParams): Promise<string>
	countActions(params: ActionParams): Promise<string>
	getStoreActionsLog(params: ActionLogParams): Promise<string>
	applyPreviousState(params?: { env?: StoreEnv }): Promise<string>
	applyNextState(params?: { env?: StoreEnv }): Promise<string>
	// frontend: dom
	runCommand(command: string): Promise<string>
	findElement(selector: string, depth?: number, maxChildren?: number, command?: string): Promise<string>
	clickElement(id?: string, selector?: string): Promise<string>
	scrollElement(id?: string, direction?: string, selector?: string): Promise<string>
	typeText(id?: string, selector?: string, text?: string, submit?: boolean): Promise<string>
	selectOption(id?: string, value?: string): Promise<string>
	getScreenshot(): Promise<string>
	dragElement(selector?: string, direction?: string, pixels?: number): Promise<string>
	dragFromTo(from?: Record<string, unknown>, to?: Record<string, unknown>): Promise<string>
	getActivePage(): Promise<string>
}

/**
 * Build the concrete {@link DevtoolMethods} object from a host provider and a
 * config. The provider supplies command execution and webview messaging; the
 * config's `backend.store` / `frontend.store` adapters decide which store
 * methods resolve to real data.
 */
export function buildDevtoolMethods(
	provider: DevtoolBridgeProvider,
	config?: DevtoolConfig,
	legacyBackendStore?: BackendStore,
	legacyFrontendBridge?: FrontendBridge,
): DevtoolMethods {
	const resolved = resolveConfig(config)
	const backendStore = legacyBackendStore
	const frontendBridge = legacyFrontendBridge
	registerGlobalErrorHandlers()

	const infoMethods = buildInfoMethods(provider.getExtensionVersion, resolved, backendStore, frontendBridge)

	// ── DOM query methods (webview round-trips through the provider) ──
	const dom = buildDomMethods(provider)

	return {
		// backend: console
		async getLogs(lines = 100) {
			const allLogs = diagnosticsManager.getAllLogs()
			const formattedLines = tailReversed(allLogs, lines).map(formatLogLine)
			return JSON.stringify({ lines: formattedLines, totalLines: allLogs.length })
		},
		async getDiagnosticsSnapshot(params?: Record<string, unknown>) {
			const snapshot = diagnosticsManager.getSnapshot(params as SnapshotFilters)
			return JSON.stringify(snapshot)
		},
		async clearDiagnostics() {
			diagnosticsManager.clear()
			return JSON.stringify({ success: true })
		},
		async getConsole(params) {
			return handleGetConsole(params, frontendBridge)
		},
		async searchConsole(params) {
			return handleSearchConsole(params, frontendBridge)
		},
		// backend: commands
		async executeVscodeCommand(command: string, args?: unknown) {
			if (!provider.executeCommand) {
				throw new Error("executeVscodeCommand unavailable - no host command adapter installed")
			}
			await provider.executeCommand(command, args)
			return JSON.stringify({ success: true, command })
		},
		// backend: info
		...infoMethods,
		// stores
		async getStoreState(params: GetStoreStateParams) {
			return getStoreState(
				{
					env: params?.env,
					store: params?.store,
					path: params?.path,
					limit: params?.limit,
					cursor: params?.cursor,
					fields: params?.fields,
				},
				backendStore,
				frontendBridge,
			)
		},
		async searchState(params: SearchParams) {
			if (params.env === "backend") {
				return searchBackendState(params, backendStore)
			}
			return searchFrontendState(params, frontendBridge)
		},
		async getStoreActions(params: ActionParams) {
			if (params.env === "backend") {
				return getStoreActions(params, backendStore)
			}
			return getFrontendStoreActions(params, frontendBridge)
		},
		async filterActions(params: FilterActionParams) {
			if (params.env === "backend") {
				return filterActions(params, backendStore)
			}
			return filterFrontendActions(params, frontendBridge)
		},
		async searchActions(params: SearchActionParams) {
			if (params.env === "backend") {
				return searchActions(params, backendStore)
			}
			return searchFrontendActions(params, frontendBridge)
		},
		async countActions(params: ActionParams) {
			if (params.env === "backend") {
				return countActions(params, backendStore)
			}
			return countFrontendActions(params, frontendBridge)
		},
		async getStoreActionsLog(params: ActionLogParams) {
			if (params.env === "backend") {
				return getStoreActionsLog(params, backendStore)
			}
			return getFrontendStoreActionsLog(params, frontendBridge)
		},
		async applyPreviousState() {
			return JSON.stringify({ success: false, error: "Not implemented" })
		},
		async applyNextState() {
			return JSON.stringify({ success: false, error: "Not implemented" })
		},
		// frontend: dom
		...dom,
	}
}
