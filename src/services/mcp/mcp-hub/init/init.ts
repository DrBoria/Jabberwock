import * as fs from "fs/promises"
import * as vscode from "vscode"
import * as path from "path"

import { McpSettingsSchema } from "@services/mcp/config/schemas"
import { t } from "@i18n"
import { getWorkspacePath } from "@utils/io/path"

import type { McpHubState } from "@services/mcp/core/types"

// ─── Debounce config change ──────────────────────────────────────────

import { getSettingsAccess } from "@utils/settings"

export function debounceConfigChange(
	state: McpHubState,
	filePath: string,
	source: "global" | "project",
	handler: (filePath: string, source: "global" | "project") => Promise<void>,
): void {
	if (state.isProgrammaticUpdate) {
		return
	}

	const key = `${source}-${filePath}`

	const existingTimer = state.configChangeDebounceTimers.get(key)
	if (existingTimer) {
		clearTimeout(existingTimer)
	}

	const timer = setTimeout(async () => {
		state.configChangeDebounceTimers.delete(key)
		await handler(filePath, source)
	}, 500)

	state.configChangeDebounceTimers.set(key, timer)
}

// ─── Show error message ──────────────────────────────────────────────

export function showErrorMessage(message: string, error: unknown): void {
	console.error(`[jabberwock] ${message}:`, error)
}

// ─── Handle config file change ───────────────────────────────────────

export async function handleConfigFileChange(
	state: McpHubState,
	filePath: string,
	source: "global" | "project",
	updateServerConnections: (servers: Record<string, unknown>, source: "global" | "project") => Promise<void>,
	cleanupProjectMcpServers: () => Promise<void>,
	notifyWebview: () => Promise<void>,
): Promise<void> {
	try {
		const content = await fs.readFile(filePath, "utf-8")
		let config: unknown

		try {
			config = JSON.parse(content)
		} catch (parseError) {
			const errorMessage = t("mcp:errors.invalid_settings_syntax")
			console.error(errorMessage, parseError)
			vscode.window.showErrorMessage(errorMessage)
			return
		}

		const result = McpSettingsSchema.safeParse(config)

		if (!result.success) {
			const errorMessages = result.error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join("\n")
			vscode.window.showErrorMessage(t("mcp:errors.invalid_settings_validation", { errorMessages }))
			return
		}

		await updateServerConnections(result.data.mcpServers || {}, source)
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT" && source === "project") {
			await cleanupProjectMcpServers()
			await notifyWebview()
			vscode.window.showInformationMessage(t("mcp:info.project_config_deleted"))
		} else {
			showErrorMessage(t("mcp:errors.failed_update_project"), error)
		}
	}
}

// ─── Is MCP enabled ──────────────────────────────────────────────────

export async function isMcpEnabled(): Promise<boolean> {
	try {
		const { mcpEnabled } = getSettingsAccess().getValues()
		return mcpEnabled ?? true
	} catch {
		return true
	}
}

// ─── Get project MCP path ────────────────────────────────────────────

export async function getProjectMcpPath(): Promise<string | null> {
	const workspacePath = getWorkspacePath()
	const projectMcpDir = path.join(workspacePath, ".jabberwock")
	const projectMcpPath = path.join(projectMcpDir, "mcp.json")

	try {
		await fs.access(projectMcpPath)
		return projectMcpPath
	} catch {
		return null
	}
}

// ─── Initialize MCP servers ──────────────────────────────────────────

export async function initializeMcpServers(
	state: McpHubState,
	source: "global" | "project",
	getMcpSettingsFilePath: () => Promise<string>,
	getProjectMcpPathFn: () => Promise<string | null>,
	updateServerConnections: (
		servers: Record<string, unknown>,
		source: "global" | "project",
		notify: boolean,
	) => Promise<void>,
): Promise<void> {
	try {
		const configPath = source === "global" ? await getMcpSettingsFilePath() : await getProjectMcpPathFn()

		if (!configPath) {
			return
		}

		const content = await fs.readFile(configPath, "utf-8")
		const config = JSON.parse(content)
		const result = McpSettingsSchema.safeParse(config)

		if (result.success) {
			await updateServerConnections(result.data.mcpServers || {}, source, false)
		} else {
			const errorMessages = result.error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join("\n")
			console.error(`[jabberwock] Invalid ${source} MCP settings format:`, errorMessages)
			vscode.window.showErrorMessage(t("mcp:errors.invalid_settings_validation", { errorMessages }))

			if (source === "global") {
				try {
					await updateServerConnections(config.mcpServers || {}, source, false)
				} catch (error) {
					showErrorMessage(`Failed to initialize ${source} MCP servers with raw config`, error)
				}
			}
		}
	} catch (error) {
		if (error instanceof SyntaxError) {
			const errorMessage = t("mcp:errors.invalid_settings_syntax")
			console.error(errorMessage, error)
			vscode.window.showErrorMessage(errorMessage)
		} else {
			showErrorMessage(`Failed to initialize ${source} MCP servers`, error)
		}
	}
}
