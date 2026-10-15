/**
 * Common devtool configuration.
 *
 * The config is the single source of truth for which MCP tool groups are
 * active. It does NOT itself know about project entities — it only aggregates
 * what the domains report (which side is configured, which store adapter is
 * present, which ports to use).
 */

import type { IStoreAdapter, StoreEnv } from "../types.js"

// ── Config ────────────────────────────────────────────────────────────────────

/**
 * Per-side (backend / frontend) configuration.
 *
 * The presence of a `store` adapter is what activates that side's state MCP
 * tools. If no store is supplied for a side, the devtool simply does not
 * register that side's state tools — the agent never sees them.
 */
export interface DevtoolSideConfig {
	/**
	 * The state store adapter for this side. Its `framework` field selects
	 * which framework-specific behaviour applies (mobx | redux | zustand |
	 * apollo | custom). Omit to disable state tools for this side.
	 */
	store?: IStoreAdapter
}

/**
 * Top-level devtool configuration. Passed once at connection time (via the
 * `<Devtool>` component, the express/nest middleware, or the `DevtoolServer` host).
 *
 * The config is the single source of truth for which MCP tool groups are
 * active:
 * - no `backend`  → backend-only features (backend store, backend console) are
 *   invisible to the agent;
 * - no `frontend` → frontend-only features are invisible;
 * - a side with a `store` of framework `X`  → that framework's state tools are
 *   registered for that side.
 */
export interface DevtoolConfig {
	backend?: DevtoolSideConfig
	frontend?: DevtoolSideConfig
	/** WebSocket MCP server port (default 60060). */
	port?: number
	/** HTTP status server port (default 60061). */
	statusPort?: number
}

/** The set of MCP tool groups that should be registered for a given config. */
export interface ResolvedDevtoolConfig {
	/** True if a backend side (and hence backend features) is configured. */
	backendEnabled: boolean
	/** True if a frontend side (and hence frontend features) is configured. */
	frontendEnabled: boolean
	/** The backend store adapter, if any. */
	backendStore?: IStoreAdapter
	/** The frontend store adapter, if any. */
	frontendStore?: IStoreAdapter
	/** Framework id of the backend store (e.g. "mobx"), if any. */
	backendFramework?: string
	/** Framework id of the frontend store (e.g. "redux"), if any. */
	frontendFramework?: string
	/** Resolved WebSocket MCP port. */
	port: number
	/** Resolved HTTP status port. */
	statusPort: number
}

export const DEFAULT_MCP_PORT = 60060
export const DEFAULT_STATUS_PORT = 60061

/**
 * Normalize a (possibly partial) {@link DevtoolConfig} into a fully-resolved
 * form with explicit feature flags. This is the function the `<Devtool>`
 * component, the express/nest middleware, and the `DevtoolServer` host all call to
 * decide which MCP tool groups to register.
 */
export function resolveConfig(config: DevtoolConfig = {}): ResolvedDevtoolConfig {
	const backendEnabled = config.backend !== undefined
	const frontendEnabled = config.frontend !== undefined

	const backendStore = config.backend?.store
	const frontendStore = config.frontend?.store

	return {
		backendEnabled,
		frontendEnabled,
		backendStore,
		frontendStore,
		backendFramework: backendStore?.framework,
		frontendFramework: frontendStore?.framework,
		port: config.port ?? DEFAULT_MCP_PORT,
		statusPort: config.statusPort ?? DEFAULT_STATUS_PORT,
	}
}

/**
 * Which state-store environments have an adapter available. Used to gate the
 * `env` parameter of the state MCP tools: an env with no store is simply not
 * offered to the agent.
 */
export function availableStoreEnvs(resolved: ResolvedDevtoolConfig): StoreEnv[] {
	const envs: StoreEnv[] = []
	if (resolved.backendStore) envs.push("backend")
	if (resolved.frontendStore) envs.push("frontend")
	return envs
}
