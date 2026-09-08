import type { Language, ExperimentId } from "@jabberwock/types"
import { changeLanguage } from "@i18n"
import { Package } from "@shared/package"
import { experimentDefault } from "@shared/experiments"
// D4g-2 (batch 3): the settings handlers only use the static terminal-config setters, which live
// on the vscode-free BaseTerminal (Terminal extends it). Importing BaseTerminal instead of the
// vscode-importing Terminal keeps the settings handler graph host-neutral.
import { BaseTerminal as Terminal } from "@integrations/terminal/terminal-core/BaseTerminal"
import { setTtsEnabled, setTtsSpeed } from "@utils/token/tts"
import { getHostEnvironment } from "@features/foundation/host-context/context"
import { getConfiguration } from "@features/foundation/capabilities/registry"
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
		// D4g-2 (batch 3): config write via the capability slot (D4b) — the vscode connector backs
		// IConfiguration.update with getConfiguration(section).update(key, value, Global).
		await getConfiguration().update(Package.name, "allowedCommands", valid)
		return valid
	},
	deniedCommands: async (value) => {
		const commands = value ?? []
		const valid = Array.isArray(commands)
			? commands.filter((cmd: unknown) => typeof cmd === "string" && cmd.trim().length > 0)
			: []
		// D4g-2 (batch 3): config write via the capability slot (D4b).
		await getConfiguration().update(Package.name, "deniedCommands", valid)
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
			...(getHostEnvironment().getGlobalState("experiments") ?? experimentDefault),
			...(value as Record<ExperimentId, boolean>),
		}
	},
	customSupportPrompts: async (value) => {
		return value
	},
}
