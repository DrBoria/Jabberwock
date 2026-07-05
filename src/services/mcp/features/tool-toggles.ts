import type { McpTool } from "@jabberwock/types"
import type { McpConnection } from "@services/mcp/core/types"

// ─── Update server tool list ─────────────────────────────────────────

import { readFile } from "fs/promises"
import { safeWriteJson } from "@utils/io"

export async function updateServerToolList(
	serverName: string,
	source: "global" | "project",
	toolName: string,
	listName: "alwaysAllow" | "disabledTools",
	addTool: boolean,
	findConnection: (name: string, s?: "global" | "project") => McpConnection | undefined,
	resolveConfigPath: () => Promise<string>,
	setProgrammaticUpdateFlag: () => void,
	resetProgrammaticUpdateFlag: () => void,
	fetchToolsListFn: () => Promise<McpTool[]>,
	notifyWebview: () => Promise<void>,
): Promise<void> {
	const connection = findConnection(serverName, source)

	if (!connection) {
		throw new Error(`Server ${serverName} with source ${source} not found`)
	}

	const configPath = await resolveConfigPath()

	const normalizedPath = process.platform === "win32" ? configPath.replace(/\\\\/g, "/") : configPath

	const content = await readFile(normalizedPath, "utf-8")
	const config = JSON.parse(content)

	if (!config.mcpServers) {
		config.mcpServers = {}
	}

	if (!config.mcpServers[serverName]) {
		config.mcpServers[serverName] = {
			type: "stdio",
			command: "node",
			args: [],
		}
	}

	if (!config.mcpServers[serverName][listName]) {
		config.mcpServers[serverName][listName] = []
	}

	const targetList = config.mcpServers[serverName][listName]
	const toolIndex = targetList.indexOf(toolName)

	if (addTool) {
		if (toolIndex === -1) {
			targetList.push(toolName)
		}
	} else if (toolIndex !== -1) {
		targetList.splice(toolIndex, 1)
	}

	setProgrammaticUpdateFlag()
	try {
		await safeWriteJson(normalizedPath, config, { prettyPrint: true })
	} finally {
		resetProgrammaticUpdateFlag()
	}

	const updatedTools = await fetchToolsListFn()
	if (connection.type === "connected") {
		connection.server.tools = updatedTools
	}
	await notifyWebview()
}

// ─── Toggle helpers ──────────────────────────────────────────────────

export async function toggleToolAlwaysAllow(
	serverName: string,
	source: "global" | "project",
	toolName: string,
	shouldAllow: boolean,
	updateFn: (
		serverName: string,
		source: "global" | "project",
		toolName: string,
		listName: "alwaysAllow" | "disabledTools",
		addTool: boolean,
	) => Promise<void>,
): Promise<void> {
	try {
		await updateFn(serverName, source, toolName, "alwaysAllow", shouldAllow)
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error)
		console.error(
			`[jabberwock] Failed to toggle always allow for tool "${toolName}" on server "${serverName}" with source "${source}": ${errorMsg}`,
		)
		throw error
	}
}

export async function toggleToolEnabledForPrompt(
	serverName: string,
	source: "global" | "project",
	toolName: string,
	isEnabled: boolean,
	updateFn: (
		serverName: string,
		source: "global" | "project",
		toolName: string,
		listName: "alwaysAllow" | "disabledTools",
		addTool: boolean,
	) => Promise<void>,
): Promise<void> {
	try {
		const addToolToDisabledList = !isEnabled
		await updateFn(serverName, source, toolName, "disabledTools", addToolToDisabledList)
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error)
		console.error(`[jabberwock] Failed to update settings for tool ${toolName}: ${errorMsg}`)
		throw error
	}
}
