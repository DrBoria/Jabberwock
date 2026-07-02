import type { Language, ExperimentId, JabberwockSettings } from "@jabberwock/types"
import { getTelemetryService, hasTelemetryService } from "@jabberwock/telemetry"
import { changeLanguage } from "@i18n"
import { Package } from "@shared/package"
import { experimentDefault } from "@shared/experiments"
import { Terminal } from "@integrations/terminal/terminal-core/Terminal"
import { setTtsEnabled, setTtsSpeed } from "@utils/token/tts"
import * as vscode from "vscode"
import { getVscodeContext } from "@features/foundation/vscode/context"
import { getSettingsAccess } from "@utils/settings"
import { getMcpServerManager } from "@services/mcp/core/McpServerManager"

type SettingHandler = (value: unknown) => Promise<unknown>

export const SETTING_HANDLERS: Record<string, SettingHandler> = {
	language: async (value) => {
		const lang = value ?? "en"
		changeLanguage(lang as Language)
		return lang
	},
	allowedCommands: async (value) => {
		const commands = value ?? []
		const valid = Array.isArray(commands)
			? commands.filter((cmd: unknown) => typeof cmd === "string" && cmd.trim().length > 0)
			: []
		await vscode.workspace
			.getConfiguration(Package.name)
			.update("allowedCommands", valid, vscode.ConfigurationTarget.Global)
		return valid
	},
	deniedCommands: async (value) => {
		const commands = value ?? []
		const valid = Array.isArray(commands)
			? commands.filter((cmd: unknown) => typeof cmd === "string" && cmd.trim().length > 0)
			: []
		await vscode.workspace
			.getConfiguration(Package.name)
			.update("deniedCommands", valid, vscode.ConfigurationTarget.Global)
		return valid
	},
	ttsEnabled: async (value) => {
		const enabled = value ?? true
		setTtsEnabled(enabled as boolean)
		return enabled
	},
	ttsSpeed: async (value) => {
		const speed = value ?? 1.0
		setTtsSpeed(speed as number)
		return speed
	},
	terminalShellIntegrationTimeout: async (value) => {
		if (value !== undefined) Terminal.setShellIntegrationTimeout(value as number)
		return value
	},
	terminalShellIntegrationDisabled: async (value) => {
		if (value !== undefined) Terminal.setShellIntegrationDisabled(value as boolean)
		return value
	},
	terminalCommandDelay: async (value) => {
		if (value !== undefined) Terminal.setCommandDelay(value as number)
		return value
	},
	terminalPowershellCounter: async (value) => {
		if (value !== undefined) Terminal.setPowershellCounter(value as boolean)
		return value
	},
	terminalZshClearEolMark: async (value) => {
		if (value !== undefined) Terminal.setTerminalZshClearEolMark(value as boolean)
		return value
	},
	terminalZshOhMy: async (value) => {
		if (value !== undefined) Terminal.setTerminalZshOhMy(value as boolean)
		return value
	},
	terminalZshP10k: async (value) => {
		if (value !== undefined) Terminal.setTerminalZshP10k(value as boolean)
		return value
	},
	terminalZdotdir: async (value) => {
		if (value !== undefined) Terminal.setTerminalZdotdir(value as boolean)
		return value
	},
	execaShellPath: async (value) => {
		Terminal.setExecaShellPath(value as string | undefined)
		return value
	},
	mcpEnabled: async (value) => {
		const enabled = value ?? true
		const mcpHub = await getMcpServerManager().getMcpHub()
		if (mcpHub) await mcpHub.handleMcpEnabledChange(enabled as boolean)
		return enabled
	},
	experiments: async (value) => {
		if (!value) return value
		return {
			...(getVscodeContext().getGlobalState("experiments") ?? experimentDefault),
			...(value as Record<ExperimentId, boolean>),
		}
	},
	customSupportPrompts: async (value) => {
		return value
	},
}
