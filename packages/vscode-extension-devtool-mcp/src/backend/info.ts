import type { ResolvedDevtoolConfig } from "../mcp/config.js"
import type { BackendStore, FrontendBridge } from "../types.js"

/**
 * Backend info: the single full health check.
 *
 * `get_extension_info` reports everything the agent needs to understand the
 * current state of the extension:
 * - package name + version
 * - backend availability + store framework + top-level stores
 * - frontend (webview) availability + store framework + top-level stores
 * - which MCP tool groups are active
 */
const BACKEND_TOOLS = [
	"get_logs",
	"get_diagnostics_snapshot",
	"clear_diagnostics",
	"get_console",
	"search_console",
	"execute_vscode_command",
]
const FRONTEND_TOOLS = [
	"find_element",
	"click_element",
	"type_text",
	"scroll_element",
	"select_option",
	"drag_element",
	"drag_from_to",
	"run_command",
	"get_screenshot",
	"get_active_page",
]
const STORE_TOOLS = [
	"get_store_state",
	"search_state",
	"get_store_actions",
	"filter_actions",
	"search_actions",
	"count_actions",
	"apply_previous_state",
	"apply_next_state",
	"get_store_actions_log",
]

interface StoreInfo {
	framework: string | null
	stores: string[]
}

type StoreInfoWith = StoreInfo & { available: boolean }
type FrontendInfo = StoreInfo & { available: boolean; webview: boolean }

const storeNames = (store: { getSnapshot: () => unknown; framework: string }): StoreInfo => ({
	framework: store.framework,
	stores: Object.keys(store.getSnapshot() as Record<string, unknown>),
})

const buildBackend = (
	resolved: ResolvedDevtoolConfig | undefined,
	backendStore: BackendStore | undefined,
): StoreInfoWith => {
	const available = resolved?.backendEnabled ?? false
	if (resolved?.backendStore) return { available, ...storeNames(resolved.backendStore) }
	const mstStore = backendStore?.getMstStore()
	if (mstStore) return { available, framework: "mobx", stores: Object.keys(mstStore as Record<string, unknown>) }

	return { available, framework: resolved?.backendFramework ?? null, stores: [] }
}

const buildFrontend = (
	resolved: ResolvedDevtoolConfig | undefined,
	frontendBridge: FrontendBridge | undefined,
): FrontendInfo => {
	const available = resolved?.frontendEnabled ?? false
	const webview = frontendBridge !== undefined
	if (resolved?.frontendStore) return { available, webview, ...storeNames(resolved.frontendStore) }

	return { available, webview, framework: resolved?.frontendFramework ?? null, stores: [] }
}

const buildActiveTools = (resolved: ResolvedDevtoolConfig | undefined) => ({
	backend: resolved?.backendEnabled ? BACKEND_TOOLS : [],
	stores: resolved?.backendStore || resolved?.frontendStore ? STORE_TOOLS : [],
	frontend: resolved?.frontendEnabled ? FRONTEND_TOOLS : [],
})

export function buildInfoMethods(
	getExtensionVersion: (() => string | undefined) | undefined,
	resolved: ResolvedDevtoolConfig | undefined,
	backendStore: BackendStore | undefined,
	frontendBridge: FrontendBridge | undefined,
) {
	return {
		async getExtensionInfo() {
			const info = {
				name: "vscode-extension-devtool-mcp",
				version: getExtensionVersion?.() ?? "dev",
				backend: buildBackend(resolved, backendStore),
				frontend: buildFrontend(resolved, frontendBridge),
				activeTools: buildActiveTools(resolved),
			}

			return JSON.stringify(info, null, 2)
		},
	}
}
