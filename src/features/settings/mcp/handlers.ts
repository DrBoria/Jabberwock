import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import type { EventBridge } from "../../../core/webview/EventBridge"
import type { WebviewMessage } from "@jabberwock/types"
import { t } from "../../../i18n"
import { openFile } from "../../../integrations/misc/open-file"
import { fileExistsAtPath } from "../../../utils/fs"
import { safeWriteJson } from "../../../utils/safeWriteJson"

import { postStateToWebview } from "../../foundation/window-manager/store"
export type HandlerFn = (provider: EventBridge, message: WebviewMessage) => Promise<void>

export const handlerMap: Record<string, HandlerFn> = {
	openMcpSettings: async (provider, message) => {
		const mcpHub = await provider.getMcpHub()
		const mcpSettingsFilePath = await mcpHub?.getMcpSettingsFilePath()

		if (mcpSettingsFilePath) {
			openFile(mcpSettingsFilePath)
		}
	},

	openProjectMcpSettings: async (provider, message) => {
		if (!vscode.workspace.workspaceFolders?.length) {
			vscode.window.showErrorMessage(t("common:errors.no_workspace"))
			return
		}

		const getCurrentCwd = () => {
			return provider.getCurrentTask()?.cwd || provider.cwd
		}
		const workspaceFolder = getCurrentCwd()
		const rooDir = path.join(workspaceFolder, ".jabberwock")
		const mcpPath = path.join(rooDir, "mcp.json")

		try {
			await fs.mkdir(rooDir, { recursive: true })
			const exists = await fileExistsAtPath(mcpPath)

			if (!exists) {
				await safeWriteJson(mcpPath, { mcpServers: {} }, { prettyPrint: true })
			}

			await openFile(mcpPath)
		} catch (error) {
			vscode.window.showErrorMessage(t("mcp:errors.create_json", { error: `${error}` }))
		}
	},

	deleteMcpServer: async (provider, message) => {
		if (!message.serverName) {
			return
		}

		try {
			provider.log(`Attempting to delete MCP server: ${message.serverName}`)
			const deleteMcpHub = await provider.getMcpHub()
			await deleteMcpHub?.deleteServer(message.serverName, message.source as "global" | "project")
			provider.log(`Successfully deleted MCP server: ${message.serverName}`)

			// Refresh the webview state
			await postStateToWebview(provider)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			provider.log(`Failed to delete MCP server: ${errorMessage}`)
		}
	},

	restartMcpServer: async (provider, message) => {
		try {
			const restartMcpHub = await provider.getMcpHub()
			await restartMcpHub?.restartConnection(message.text!, message.source as "global" | "project")
		} catch (error) {
			provider.log(
				`Failed to retry connection for ${message.text}: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
			)
		}
	},

	toggleToolAlwaysAllow: async (provider, message) => {
		try {
			const mcpHub = await provider.getMcpHub()
			await mcpHub?.toggleToolAlwaysAllow(
				message.serverName!,
				message.source as "global" | "project",
				message.toolName!,
				Boolean(message.alwaysAllow),
			)
		} catch (error) {
			provider.log(
				`Failed to toggle auto-approve for tool ${message.toolName}: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
			)
		}
	},

	toggleToolEnabledForPrompt: async (provider, message) => {
		try {
			const mcpHub = await provider.getMcpHub()
			await mcpHub?.toggleToolEnabledForPrompt(
				message.serverName!,
				message.source as "global" | "project",
				message.toolName!,
				Boolean(message.isEnabled),
			)
		} catch (error) {
			provider.log(
				`Failed to toggle enabled for prompt for tool ${message.toolName}: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
			)
		}
	},

	toggleMcpServer: async (provider, message) => {
		try {
			const mcpHub = await provider.getMcpHub()
			await mcpHub?.toggleServerDisabled(
				message.serverName!,
				message.disabled!,
				message.source as "global" | "project",
			)
		} catch (error) {
			provider.log(
				`Failed to toggle MCP server ${message.serverName}: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
			)
		}
	},

	updateMcpTimeout: async (provider, message) => {
		try {
			const timeout = (message.value as number | undefined) ?? 60
			const mcpHub = await provider.getMcpHub()
			await mcpHub?.updateServerTimeout(message.serverName!, timeout, message.source as "global" | "project")
		} catch (error) {
			provider.log(
				`Failed to update MCP timeout for ${message.serverName}: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
			)
		}
	},

	refreshAllMcpServers: async (provider, message) => {
		const refreshMcpHub = await provider.getMcpHub()

		if (refreshMcpHub) {
			await refreshMcpHub.refreshAllConnections()
		}
	},
}
