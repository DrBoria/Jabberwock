import { McpHub } from "../../../services/mcp/McpHub"
import { getModeBySlug, defaultModeSlug, getGroupName } from "../../../shared/modes"
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

	let mcpServersList = ""
	if (mcpHub && hasMcpGroup) {
		const mcpList = modeConfig?.mcpList
		const visibleServers = mcpHub.getServers(mcpList)

		if (visibleServers.length > 0) {
			mcpServersList = "\n\nAvailable MCP servers:\n" + visibleServers.map((s) => `- ${s.name}`).join("\n")
		}
	}

	const cliSection = hasCommandGroup
		? `\n- You can use the execute_command tool to run commands on the user's computer whenever you feel it can help accomplish the user's task. When you execute a CLI command, provide a clear explanation. Interactive and long-running commands are allowed as they run in the user's terminal.`
		: ""

	const fileSection = hasEditGroup
		? `\n- You have access to tools that let you write files and apply sources code changes (write_to_file, apply_diff, etc.).`
		: ""

	const readSection = hasReadGroup
		? `\n- You can list files recursively, read code definitions, and perform regex searches in the workspace ('${cwd}'). This provides an overview of the project structure and helps you navigate the codebase.`
		: ""

	const mcpSection =
		mcpHub && hasMcpGroup
			? `\n- You have access to MCP servers that provide additional tools and resources tailored to your role.${mcpServersList}`
			: ""

	return `====

CAPABILITIES
${cliSection}${fileSection}${readSection}${mcpSection}
- You can always ask follow-up questions and use the delegate_task tool to coordinate with other agents or ask for user input.`
}
