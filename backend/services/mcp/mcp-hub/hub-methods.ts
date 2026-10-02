// v4 B2 (L14): thin wrappers over the mcp-hub helpers, bound to a live state
// accessor. Extracted from the McpHub factory to keep the factory under the
// max-lines budget. No host imports — structural types only.
import type { McpResourceResponse, McpServer, McpToolCallResponse } from "@jabberwock/types"
import type { ProviderHandle } from "@features/foundation/webview"
import type { IExtensionContextView } from "@features/foundation/host-context/context"
import type { McpHubState } from "@services/mcp/core/types"
import { getMcpServersPath as getMcpServersPathFromFile } from "@services/mcp/config"
import { getServers, getAllServers, deleteConnection } from "./connection"
import {
	toggleServerDisabled,
	updateServerTimeout,
	handleMcpEnabledChange,
	refreshAllConnections,
	refreshServerCapabilities,
	callTool as callToolHelper,
	readResource as readResourceHelper,
	restartConnection,
	deleteServer,
} from "./server"
import {
	toggleToolAlwaysAllow as toggleToolAlwaysAllowExt,
	toggleToolEnabledForPrompt as toggleToolEnabledForPromptExt,
} from "./tool-toggle-methods"
import { initializeAllServers, type HubDeps } from "./init"

export interface HubMethodsDeps {
	s: () => McpHubState
	providerRef: WeakRef<ProviderHandle>
	context: IExtensionContextView
	sanitizedNameRegistry: Map<string, string>
	getMcpSettingsFilePath: () => Promise<string>
	notifyWebview: () => Promise<void>
	hubDeps: () => HubDeps
}

export function createHubMethods(deps: HubMethodsDeps) {
	const { s, providerRef, context, sanitizedNameRegistry, getMcpSettingsFilePath, notifyWebview, hubDeps } = deps

	const getServersFn = (agentMcpList?: string[]): McpServer[] =>
		getServers(s(), (_name, _config, _mcpList) => true, agentMcpList)

	const getAllServersFn = (): McpServer[] => getAllServers(s())

	async function getMcpServersPath(): Promise<string> {
		const prov = providerRef.deref()
		if (!prov) {
			throw new Error("Provider not available")
		}
		return getMcpServersPathFromFile(context.storageUri?.fsPath ?? "")
	}

	const deleteConnectionFn = (name: string, source?: "global" | "project"): Promise<void> =>
		deleteConnection(s(), name, source)

	const findServerNameBySanitizedName = (sanitizedServerName: string): string | null =>
		sanitizedNameRegistry.get(sanitizedServerName) ?? null

	const restartConnectionFn = (serverName: string, source?: "global" | "project"): Promise<void> =>
		restartConnection(s(), serverName, source)

	const initializeMcpServers = (_source: "global" | "project"): Promise<void> => initializeAllServers(hubDeps())

	const refreshAllConnectionsFn = (): Promise<void> =>
		refreshAllConnections(
			s(),
			() => getMcpSettingsFilePath(),
			(source) => initializeMcpServers(source),
		)

	const toggleServerDisabledFn = (
		serverName: string,
		disabled: boolean,
		source?: "global" | "project",
	): Promise<void> => toggleServerDisabled(s(), serverName, disabled, () => getMcpSettingsFilePath(), source)

	const updateServerTimeoutFn = (serverName: string, timeout: number, source?: "global" | "project"): Promise<void> =>
		updateServerTimeout(s(), serverName, timeout, () => getMcpSettingsFilePath(), source)

	const deleteServerFn = (serverName: string, source?: "global" | "project"): Promise<void> =>
		deleteServer(s(), serverName, () => getMcpSettingsFilePath(), source)

	const readResourceFn = (
		serverName: string,
		uri: string,
		source?: "global" | "project",
	): Promise<McpResourceResponse> => readResourceHelper(s(), serverName, uri, source)

	const callToolFn = (
		serverName: string,
		toolName: string,
		toolArguments?: Record<string, unknown>,
		source?: "global" | "project",
	): Promise<McpToolCallResponse> => callToolHelper(s(), serverName, toolName, toolArguments, source)

	const updateServerToolList = (serverName: string, source?: "global" | "project"): Promise<void> =>
		refreshServerCapabilities(s(), serverName, source ?? "global", () => getMcpSettingsFilePath())

	const toggleToolAlwaysAllowFn = (
		serverName: string,
		toolName: string,
		alwaysAllow: boolean,
		source?: "global" | "project",
	): Promise<void> =>
		toggleToolAlwaysAllowExt(
			() => s(),
			serverName,
			toolName,
			alwaysAllow,
			source,
			() => getMcpSettingsFilePath(),
			() => notifyWebview(),
		)

	const toggleToolEnabledForPromptFn = (
		serverName: string,
		toolName: string,
		enabled: boolean,
		source?: "global" | "project",
	): Promise<void> =>
		toggleToolEnabledForPromptExt(
			() => s(),
			serverName,
			toolName,
			enabled,
			source,
			() => getMcpSettingsFilePath(),
			() => notifyWebview(),
		)

	const handleMcpEnabledChangeFn = (enabled: boolean): Promise<void> =>
		handleMcpEnabledChange(s(), enabled, () => refreshAllConnectionsFn())

	return {
		getServers: getServersFn,
		getAllServers: getAllServersFn,
		getMcpServersPath,
		deleteConnection: deleteConnectionFn,
		findServerNameBySanitizedName,
		restartConnection: restartConnectionFn,
		refreshAllConnections: refreshAllConnectionsFn,
		toggleServerDisabled: toggleServerDisabledFn,
		updateServerTimeout: updateServerTimeoutFn,
		deleteServer: deleteServerFn,
		readResource: readResourceFn,
		callTool: callToolFn,
		updateServerToolList,
		toggleToolAlwaysAllow: toggleToolAlwaysAllowFn,
		toggleToolEnabledForPrompt: toggleToolEnabledForPromptFn,
		handleMcpEnabledChange: handleMcpEnabledChangeFn,
	}
}

export type HubMethods = ReturnType<typeof createHubMethods>
