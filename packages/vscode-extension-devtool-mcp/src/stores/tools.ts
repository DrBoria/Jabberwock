import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { DevtoolMethods } from "../mcp/server.js"
import type { StoreEnv } from "../types.js"
import { registerStateTools } from "./state.js"
import { MOBX_FRAMEWORK } from "./mobx/tools.js"
import { REDUX_FRAMEWORK } from "./redux/tools.js"
import { ZUSTAND_FRAMEWORK } from "./zustand/tools.js"
import { APOLLO_FRAMEWORK } from "./apollo/tools.js"

// Re-export the per-framework adapters so the stores domain is a single entry
// point for building store adapters.
export { createMobxAdapter, type MobxAdapterOptions } from "./mobx/tools.js"
export { createReduxAdapter, type ReduxAdapterOptions, type ReduxStoreLike } from "./redux/tools.js"
export { createZustandAdapter, type ZustandAdapterOptions, type ZustandStoreLike } from "./zustand/tools.js"
export { createApolloAdapter, type ApolloAdapterOptions } from "./apollo/tools.js"
// `createPlainAdapter` is the shared base implementation, now duplicated into
// each framework folder that uses it (redux/zustand/apollo). Re-export the
// redux copy to keep the public name importable.
export { createPlainAdapter, type PlainAdapterOptions } from "./redux/store.js"

export { registerStateTools } from "./state.js"

/** Framework ids that the stores domain knows how to adapt. */
export const STORE_FRAMEWORKS = [MOBX_FRAMEWORK, REDUX_FRAMEWORK, ZUSTAND_FRAMEWORK, APOLLO_FRAMEWORK] as const

/**
 * Stores-domain tool selector.
 *
 * Imports the per-framework tools (mobx/redux/zustand/apollo) and the shared
 * state tools, then decides which are active based on what exists in the
 * project:
 *
 * - The shared state tools (`get_store_state`, `search_state`,
 *   `get_store_actions`, `filter_actions`, `search_actions`, `count_actions`,
 *   `get_store_actions_log`, `apply_previous_state`, `apply_next_state`,
 *   `get_extension_info`) are registered when at least one store environment
 *   is configured.
 */
export function registerStoreTools(
	mcpServer: McpServer,
	methods: DevtoolMethods,
	envs: StoreEnv[] = ["backend", "frontend"],
): void {
	registerStateTools(mcpServer, methods, envs)
}
