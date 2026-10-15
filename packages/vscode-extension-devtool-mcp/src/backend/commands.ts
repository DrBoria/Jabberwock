import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { DevtoolMethods } from "../mcp/server.js"

/**
 * Backend command tools: host command execution.
 *
 * `execute_vscode_command` runs a host command through the extension host —
 * the backend-side counterpart of the message interception done by
 * {@link MessageInterceptor}.
 */
export function registerCommandTools(mcpServer: McpServer, bridge: DevtoolMethods): void {
	mcpServer.tool(
		"execute_vscode_command",
		{
			command: z
				.string()
				.describe("The host command ID to execute (e.g. 'extension.openSettings', 'extension.toggleSidebar')"),
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
}
