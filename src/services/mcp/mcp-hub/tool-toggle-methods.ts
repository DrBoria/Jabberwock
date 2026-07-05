import type { McpHubState } from "@services/mcp/core/types"
import {
	toggleToolAlwaysAllow as toggleHelper,
	toggleToolEnabledForPrompt as togglePromptHelper,
	updateServerToolList,
} from "@services/mcp/features/tool-toggles"
import { findConnection } from "./connection/manager"
import { resolveConfigPath } from "@services/mcp"
import { fetchToolsList } from "@services/mcp/features/tools"
import { getProjectMcpPath } from "./init"

export async function toggleToolAlwaysAllow(
	state: () => McpHubState,
	serverName: string,
	toolName: string,
	alwaysAllow: boolean,
	source: "global" | "project" | undefined,
	getMcpSettingsFilePath: () => Promise<string>,
	notifyWebview: () => Promise<void>,
): Promise<void> {
	await toggleHelper(
		serverName,
		source ?? "global",
		toolName,
		alwaysAllow,
		(srvName, src, tlName, listName, addTool) =>
			updateServerToolList(
				srvName,
				src,
				tlName,
				listName,
				addTool,
				(name, s) => findConnection(state(), name, s),
				() => resolveConfigPath(src, () => getMcpSettingsFilePath(), getProjectMcpPath),
				() => {
					const s = state()
					s.isProgrammaticUpdate = true
				},
				() => {
					setTimeout(() => {
						const s = state()
						s.isProgrammaticUpdate = false
					}, 600)
				},
				() =>
					fetchToolsList(
						srvName,
						src,
						(name, s) => findConnection(state(), name, s),
						() => getMcpSettingsFilePath(),
						getProjectMcpPath,
					),
				() => notifyWebview(),
			),
	)
}

export async function toggleToolEnabledForPrompt(
	state: () => McpHubState,
	serverName: string,
	toolName: string,
	enabled: boolean,
	source: "global" | "project" | undefined,
	getMcpSettingsFilePath: () => Promise<string>,
	notifyWebview: () => Promise<void>,
): Promise<void> {
	await togglePromptHelper(
		serverName,
		source ?? "global",
		toolName,
		enabled,
		(srvName, src, tlName, listName, addTool) =>
			updateServerToolList(
				srvName,
				src,
				tlName,
				listName,
				addTool,
				(name, s) => findConnection(state(), name, s),
				() => resolveConfigPath(src, () => getMcpSettingsFilePath(), getProjectMcpPath),
				() => {
					const s = state()
					s.isProgrammaticUpdate = true
				},
				() => {
					setTimeout(() => {
						const s = state()
						s.isProgrammaticUpdate = false
					}, 600)
				},
				() =>
					fetchToolsList(
						srvName,
						src,
						(name, s) => findConnection(state(), name, s),
						() => getMcpSettingsFilePath(),
						getProjectMcpPath,
					),
				() => notifyWebview(),
			),
	)
}
