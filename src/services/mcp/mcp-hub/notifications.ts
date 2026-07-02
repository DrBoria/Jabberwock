import * as fs from "fs/promises"

import { McpHubState } from "@services/mcp/core/types"

// ─── Notify webview of server changes ────────────────────────────────

export async function notifyWebviewOfServerChanges(
	state: McpHubState,
	getMcpSettingsFilePath: () => Promise<string>,
	getProjectMcpPath: () => Promise<string | null>,
): Promise<void> {
	const settingsPath = await getMcpSettingsFilePath()
	const content = await fs.readFile(settingsPath, "utf-8")
	const config = JSON.parse(content)
	const globalServerOrder = Object.keys(config.mcpServers || {})

	const projectMcpPath = await getProjectMcpPath()
	let projectServerOrder: string[] = []
	if (projectMcpPath) {
		try {
			const projectContent = await fs.readFile(projectMcpPath, "utf-8")
			const projectConfig = JSON.parse(projectContent)
			projectServerOrder = Object.keys(projectConfig.mcpServers || {})
		} catch {}
	}

	const sortedConnections = [...state.connections].sort((a, b) => {
		const aIsGlobal = a.server.source === "global" || !a.server.source
		const bIsGlobal = b.server.source === "global" || !b.server.source

		if (aIsGlobal && bIsGlobal) {
			const indexA = globalServerOrder.indexOf(a.server.name)
			const indexB = globalServerOrder.indexOf(b.server.name)
			return indexA - indexB
		} else if (!aIsGlobal && !bIsGlobal) {
			const indexA = projectServerOrder.indexOf(a.server.name)
			const indexB = projectServerOrder.indexOf(b.server.name)
			return indexA - indexB
		}

		return aIsGlobal ? 1 : -1
	})

	const targetProvider = state.providerRef.deref()

	if (targetProvider) {
		const serversToSend = sortedConnections.map((connection) => connection.server)

		const message = {
			type: "mcpServers" as const,
			mcpServers: serversToSend,
		}

		try {
			await targetProvider.postMessageToWebview(message)
		} catch (error) {
			console.error("[jabberwock] [McpHub] Error calling targetProvider.postMessageToWebview:", error)
		}
	} else {
		console.error("[McpHub] No target provider available - cannot send mcpServers message to webview")
	}
}

// ─── Is server visible to agent ──────────────────────────────────────

export function isServerVisibleToAgent(
	serverName: string,
	serverConfig: Record<string, unknown>,
	agentMcpList?: string[],
): boolean {
	if (serverConfig?.disabled) {
		return false
	}

	if (!agentMcpList) {
		const visible = serverConfig?.isGloballyVisible !== false
		return visible
	}

	if (serverConfig?.isGloballyVisible === true) {
		return true
	}

	const inList = agentMcpList.includes(serverName)
	return inList
}

// ─── Read provider context ───────────────────────────────────────────

export function readProviderContext(
	targetProvider: import("@features/foundation/webview/EventBridge").ProviderHandle,
): { activeTaskId: string; agentRole: string } {
	let activeTaskId = ""
	let agentRole = ""

	if ("chatStore" in targetProvider) {
		const chatStore: { activeNodeId?: { id: string } } | undefined = (targetProvider as Record<string, unknown>)
			.chatStore as { activeNodeId?: { id: string } } | undefined
		if (chatStore?.activeNodeId) {
			activeTaskId = chatStore.activeNodeId.id
		}
	}

	if ("getState" in targetProvider) {
		const getState: (() => { mode?: string } | undefined) | undefined = (targetProvider as Record<string, unknown>)
			.getState as (() => { mode?: string } | undefined) | undefined
		if (getState) {
			const state = Reflect.apply(getState, targetProvider, [])
			agentRole = state?.mode || ""
		}
	}

	return { activeTaskId, agentRole }
}

// ─── Get workspace path ──────────────────────────────────────────────

export function getWorkspacePathValue(): string {
	const vscode = require("vscode") as typeof import("vscode")
	return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || ""
}
