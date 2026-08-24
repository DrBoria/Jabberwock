import { McpHub } from "@services/mcp/core/McpHub"
import { getModeBySlug, defaultModeSlug, getGroupName } from "@shared/modes"
import type { ModeConfig } from "@jabberwock/types"

export function getCapabilitiesSection(
	cwd: string,
	mcpHub?: McpHub,
	mode?: string,
	customModes?: ModeConfig[],
): string {
	const modeSlug = mode ?? defaultModeSlug
	const modeConfig = getModeBySlug(modeSlug, customModes)

	const groups = modeConfig?.groups?.map((g) => getGroupName(g)) ?? []
	const hasCommandGroup = groups.includes("command")
	const hasEditGroup = groups.includes("edit")
	const hasMcpGroup = groups.includes("mcp")
	const hasReadGroup = groups.includes("read")

	const mcpServersList = buildMcpServersList(mcpHub, hasMcpGroup, modeConfig)
	const cliSection = buildCapabilitySection(hasCommandGroup, buildCliText())
	const fileSection = buildCapabilitySection(hasEditGroup, buildEditText())
	const readSection = buildCapabilitySection(hasReadGroup, buildReadText(cwd))
	const mcpSection = buildMcpCapabilitySection(mcpHub, hasMcpGroup, mcpServersList)

	return `====\n\nCAPABILITIES\n${cliSection}${fileSection}${readSection}${mcpSection}\n- You can always ask follow-up questions and use the delegate_task tool to coordinate with other agents or ask for user input.`
}

function buildMcpServersList(
	mcpHub: McpHub | undefined,
	hasMcpGroup: boolean,
	modeConfig: ModeConfig | undefined,
): string {
	if (!mcpHub || !hasMcpGroup) {
		return ""
	}

	const mcpList = modeConfig?.mcpList
	const visibleServers = mcpHub.getServers(mcpList)

	if (visibleServers.length === 0) {
		return ""
	}

	return "\n\nAvailable MCP servers:\n" + visibleServers.map((s) => `- ${s.name}`).join("\n")
}

function buildCapabilitySection(hasCapability: boolean, text: string): string {
	return hasCapability ? text : ""
}

function buildMcpCapabilitySection(mcpHub: McpHub | undefined, hasMcpGroup: boolean, mcpServersList: string): string {
	if (!mcpHub || !hasMcpGroup) {
		return ""
	}

	return `\n- You have access to MCP servers that provide additional tools and resources tailored to your role.${mcpServersList}`
}

function buildCliText(): string {
	return "\n- You can use the execute_command tool to run commands on the user's computer whenever you feel it can help accomplish the user's task. When you execute a CLI command, provide a clear explanation. Interactive and long-running commands are allowed as they run in the user's terminal."
}

function buildEditText(): string {
	return "\n- You have access to tools that let you write files and apply sources code changes (write_to_file, apply_diff, etc.)."
}

function buildReadText(cwd: string): string {
	return `\n- You can list files recursively, read code definitions, and perform regex searches in the workspace ('${cwd}'). This provides an overview of the project structure and helps you navigate the codebase.`
}
