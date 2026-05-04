import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { ExtensionBridge } from "../bridge.js"

/**
 * Register command-related tools that are generic (not tied to ClineProvider).
 *
 * These tools use the ExtensionBridge to execute VS Code commands and query
 * the active page — they don't need direct access to the extension internals.
 */
export function registerCommandTools(mcpServer: McpServer, bridge: ExtensionBridge): void {
	mcpServer.tool(
		"execute_vscode_command",
		{
			command: z
				.string()
				.describe(
					"The VS Code command ID to execute (e.g. 'jabberwock.historyButtonClicked', 'jabberwock.settingsButtonClicked', 'jabberwock.plusButtonClicked')",
				),
			args: z.any().optional().describe("Optional arguments to pass to the command"),
		},
		async ({ command, args }) => {
			try {
				const result = await bridge.executeVscodeCommand(command, args)
				return {
					content: [
						{
							type: "text",
							text: `Successfully executed VS Code command: ${command}${result ? ` (result: ${result})` : ""}`,
						},
					],
				}
			} catch (error) {
				return {
					content: [{ type: "text", text: `Error executing VS Code command: ${error}` }],
					isError: true,
				}
			}
		},
	)

	mcpServer.tool("get_active_page", {}, async () => {
		try {
			const activePage = await bridge.getActivePage()
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({ activePage }, null, 2),
					},
				],
			}
		} catch (error) {
			return { content: [{ type: "text", text: `Error: ${error}` }], isError: true }
		}
	})
}
