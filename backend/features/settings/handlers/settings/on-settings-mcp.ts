import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
// v4 B2 (L4): workspace roots come from the host context DI slot, not vscode directly.
import { getWorkspaceRoots } from "@features/foundation/host-context/context"
import * as path from "path"
import * as fs from "fs/promises"
import { t } from "@i18n"
import { openFile } from "@integrations/misc/open-file"
import { fileExistsAtPath } from "@utils/io/fs"
import { safeWriteJson } from "@utils/io"
import { postStateToWebview } from "@features/foundation/window-manager/store"
import { getMcpServerManager } from "@services/mcp/core/McpServerManager"
import { log as backendLog } from "@features/foundation/capabilities/backend-logger"

/**
 * Register all MCP settings intent handlers.
 */
export function registerOnSettingsMcp(bus: IntentBus): void {
	// ── openMcpSettings ───────────────────────────────────────────────
	bus.register(IntentType.SettingsMcpSettingsOpen, async (_intent, _ctx) => {
		const mcpHub = await getMcpServerManager().getMcpHub()
		const mcpSettingsFilePath = await mcpHub?.getMcpSettingsFilePath()

		if (mcpSettingsFilePath) {
			openFile(mcpSettingsFilePath)
		}
	})

	// ── openProjectMcpSettings ────────────────────────────────────────
	bus.register(IntentType.SettingsMcpProjectSettingsOpen, async (_intent, ctx) => {
		if (getWorkspaceRoots().length === 0) {
			publishNotificationError(t("common:errors.no_workspace"))
			return
		}

		const getCurrentCwd = () => {
			return ctx.rootStore.chat.activeTask?.cwd
		}
		const workspaceFolder = getCurrentCwd() ?? ""
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
			publishNotificationError(t("mcp:errors.create_json", { error: `${error}` }))
		}
	})

	// ── deleteMcpServer ───────────────────────────────────────────────
	bus.register(IntentType.SettingsMcpServerDelete, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { serverName: string; source: string }
		if (!payload.serverName) return

		try {
			backendLog.info(`Attempting to delete MCP server: ${payload.serverName}`)
			const deleteMcpHub = await getMcpServerManager().getMcpHub()
			await deleteMcpHub?.deleteServer(payload.serverName, payload.source as "global" | "project")
			backendLog.info(`Successfully deleted MCP server: ${payload.serverName}`)

			await postStateToWebview(provider)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			backendLog.info(`Failed to delete MCP server: ${errorMessage}`)
		}
	})

	// ── restartMcpServer ──────────────────────────────────────────────
	bus.register(IntentType.SettingsMcpServerRestart, async (intent, _ctx) => {
		const payload = intent.payload as { text: string; source: string }

		try {
			const restartMcpHub = await getMcpServerManager().getMcpHub()
			await restartMcpHub?.restartConnection(payload.text, payload.source as "global" | "project")
		} catch (error) {
			backendLog.info(
				`Failed to retry connection for ${payload.text}: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
			)
		}
	})

	// ── toggleToolAlwaysAllow ─────────────────────────────────────────
	bus.register(IntentType.SettingsMcpToolAlwaysAllow, async (intent, _ctx) => {
		const payload = intent.payload as {
			serverName: string
			source: string
			toolName: string
			alwaysAllow: boolean
		}

		try {
			const mcpHub = await getMcpServerManager().getMcpHub()
			await mcpHub?.toggleToolAlwaysAllow(
				payload.serverName,
				payload.toolName,
				Boolean(payload.alwaysAllow),
				payload.source as "global" | "project",
			)
		} catch (error) {
			backendLog.info(
				`Failed to toggle auto-approve for tool ${payload.toolName}: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
			)
		}
	})

	// ── toggleToolEnabledForPrompt ────────────────────────────────────
	bus.register(IntentType.SettingsMcpToolEnabledForPrompt, async (intent, _ctx) => {
		const payload = intent.payload as {
			serverName: string
			source: string
			toolName: string
			isEnabled: boolean
		}

		try {
			const mcpHub = await getMcpServerManager().getMcpHub()
			await mcpHub?.toggleToolEnabledForPrompt(
				payload.serverName,
				payload.toolName,
				Boolean(payload.isEnabled),
				payload.source as "global" | "project",
			)
		} catch (error) {
			backendLog.info(
				`Failed to toggle enabled for prompt for tool ${payload.toolName}: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
			)
		}
	})

	// ── toggleMcpServer ───────────────────────────────────────────────
	bus.register(IntentType.SettingsMcpServerToggle, async (intent, _ctx) => {
		const payload = intent.payload as {
			serverName: string
			disabled: boolean
			source: string
		}

		try {
			const mcpHub = await getMcpServerManager().getMcpHub()
			await mcpHub?.toggleServerDisabled(
				payload.serverName,
				payload.disabled,
				payload.source as "global" | "project",
			)
		} catch (error) {
			backendLog.info(
				`Failed to toggle MCP server ${payload.serverName}: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
			)
		}
	})

	// ── updateMcpTimeout ──────────────────────────────────────────────
	bus.register(IntentType.SettingsMcpTimeoutUpdate, async (intent, _ctx) => {
		const payload = intent.payload as {
			serverName: string
			value: number
			source: string
		}

		try {
			const timeout = payload.value ?? 60
			const mcpHub = await getMcpServerManager().getMcpHub()
			await mcpHub?.updateServerTimeout(payload.serverName, timeout, payload.source as "global" | "project")
		} catch (error) {
			backendLog.info(
				`Failed to update MCP timeout for ${payload.serverName}: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
			)
		}
	})

	// ── refreshAllMcpServers ──────────────────────────────────────────
	bus.register(IntentType.SettingsMcpServersRefresh, async () => {
		const refreshMcpHub = await getMcpServerManager().getMcpHub()

		if (refreshMcpHub) {
			await refreshMcpHub.refreshAllConnections()
		}
	})
}

import { publishNotificationError } from "@features/foundation/capabilities/notifications"
