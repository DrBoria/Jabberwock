import { z } from "zod"
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ClineProvider } from "../../webview/ClineProvider"
import { SYSTEM_PROMPT } from "../../prompts/system"
import { defaultModeSlug, type Mode } from "../../../shared/modes"

export function registerPromptTools(mcpServer: McpServer, provider: ClineProvider) {
	mcpServer.tool(
		"get_system_prompt_preview",
		{
			mode: z.string().optional().describe("Mode slug (e.g. 'orchestrator', 'coder'). Defaults to current mode."),
		},
		async ({ mode }) => {
			try {
				const effectiveMode = (mode as Mode) || defaultModeSlug
				const cwd = (provider as any).currentWorkspacePath || process.cwd()

				const prompt = await SYSTEM_PROMPT(
					provider.context,
					cwd,
					true, // supportsComputerUse
					(provider as any).mcpHub,
					undefined, // diffStrategy
					effectiveMode,
					undefined, // customModePrompts
					await provider.customModesManager.getCustomModes(),
					undefined, // globalCustomInstructions
					undefined, // experiments
					undefined, // language
					undefined, // jabberwockIgnoreInstructions
					{
						todoListEnabled: true,
						useAgentRules: true,
						newTaskRequireTodos: false,
					},
				)

				return {
					content: [{ type: "text", text: prompt }],
				}
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error generating prompt preview: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				}
			}
		},
	)
}
