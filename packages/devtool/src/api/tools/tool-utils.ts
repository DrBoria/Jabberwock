import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

export type ToolResult = {
	content: Array<{ type: "text"; text: string }>
	isError?: boolean
}

export async function wrapBridge<T>(bridgeCall: () => Promise<T>): Promise<ToolResult> {
	try {
		const result = await bridgeCall()
		return { content: [{ type: "text", text: String(result) }] }
	} catch (error) {
		return {
			content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
			isError: true,
		}
	}
}

export function registerSimpleTool(
	mcpServer: McpServer,
	name: string,
	schema: Record<string, unknown>,
	handler: () => Promise<ToolResult>,
): void {
	mcpServer.tool(name, schema, handler)
}
