import { z } from "zod"
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { getSnapshot } from "mobx-state-tree"
import { type ClineProvider } from "../../webview/ClineProvider"
import { agentStore } from "../../state/AgentStore"

export function registerAgentTools(mcpServer: McpServer, provider: ClineProvider) {
	mcpServer.tool("get_agent_store", {}, async () => {
		try {
			const snapshot = getSnapshot(agentStore)
			return {
				content: [{ type: "text", text: JSON.stringify(snapshot, null, 2) }],
			}
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `Error getting agent store: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			}
		}
	})

	mcpServer.tool(
		"update_agent_profile",
		{
			id: z.string().describe("The ID of the agent to update (e.g. 'orchestrator', 'coder')"),
			name: z.string().optional().describe("New name for the agent"),
			role: z.string().optional().describe("New role description"),
			systemPrompt: z.string().optional().describe("New system prompt"),
			allowedTools: z.array(z.string()).optional().describe("List of tool IDs allowed for this agent"),
		},
		async ({ id, name, role, systemPrompt, allowedTools }) => {
			try {
				const agent = agentStore.agents.get(id)
				if (!agent) {
					return {
						content: [{ type: "text", text: `Error: Agent with ID "${id}" not found` }],
						isError: true,
					}
				}

				if (name) agent.name = name
				if (role) agent.role = role
				if (systemPrompt) agent.systemPrompt = systemPrompt
				if (allowedTools) {
					// Verify tools exist before assigning
					const missingTools = allowedTools.filter((tId) => !agentStore.tools.has(tId))
					if (missingTools.length > 0) {
						return {
							content: [{ type: "text", text: `Error: Tools not found: ${missingTools.join(", ")}` }],
							isError: true,
						}
					}
					agent.allowedTools.clear()
					allowedTools.forEach((tId) => {
						const tool = agentStore.tools.get(tId)
						if (tool) agent.allowedTools.push(tool)
					})
				}

				return { content: [{ type: "text", text: `Successfully updated agent profile: ${id}` }] }
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error updating agent profile: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				}
			}
		},
	)

	mcpServer.tool(
		"register_agent",
		{
			id: z.string().describe("Unique ID for the new agent"),
			name: z.string().describe("Human readable name"),
			role: z.string().describe("Role description"),
			systemPrompt: z.string().describe("Full system prompt for the agent"),
			allowedTools: z.array(z.string()).describe("Initial list of allowed tool IDs"),
		},
		async ({ id, name, role, systemPrompt, allowedTools }) => {
			try {
				if (agentStore.agents.has(id)) {
					return {
						content: [{ type: "text", text: `Error: Agent with ID "${id}" already exists` }],
						isError: true,
					}
				}

				// Verify tools exist
				const missingTools = allowedTools.filter((tId) => !agentStore.tools.has(tId))
				if (missingTools.length > 0) {
					return {
						content: [{ type: "text", text: `Error: Tools not found: ${missingTools.join(", ")}` }],
						isError: true,
					}
				}

				agentStore.registerAgent({ id, name, role, systemPrompt, allowedTools })
				return { content: [{ type: "text", text: `Successfully registered new agent: ${id}` }] }
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error registering agent: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				}
			}
		},
	)

	mcpServer.tool(
		"update_tool_config",
		{
			id: z.string().describe("The ID of the tool to update"),
			isEnabled: z.boolean().describe("Whether the tool is enabled"),
		},
		async ({ id, isEnabled }) => {
			try {
				const tool = agentStore.tools.get(id)
				if (!tool) {
					return { content: [{ type: "text", text: `Error: Tool with ID "${id}" not found` }], isError: true }
				}

				tool.setEnabled(isEnabled)
				return {
					content: [{ type: "text", text: `Successfully updated tool "${id}" (isEnabled: ${isEnabled})` }],
				}
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error updating tool config: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				}
			}
		},
	)
}
