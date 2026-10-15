/**
 * Frontend interceptor MCP tools.
 *
 * Mirror of the backend interceptor tools, but on the WEBVIEW side: the
 * {@link FrontendMessageInterceptor} wraps the webview's `postMessage`
 * channel, so these tools intercept the FRONTEND→BACKEND direction. Sending
 * a message here goes through `send()` — if a "send" interceptor matches it
 * is traced and short-circuited with the canned response, otherwise it is
 * delivered to the extension host. Tool names carry the `frontend_` prefix to
 * stay distinct from the backend interceptor tools.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { FrontendMessageInterceptor } from "./index.js"
import { registerInterceptorTools } from "../../mcp/interceptor/tools.js"

export function registerFrontendInterceptorTools(mcpServer: McpServer, interceptor: FrontendMessageInterceptor): void {
	registerInterceptorTools(mcpServer, interceptor, {
		prefix: "frontend_",
		directions: { send: "frontend→backend" },
		sendTool: {
			name: "send_message_to_backend",
			description: "Send a message from the webview to the extension host through the interceptor",
			send: (message) => interceptor.send(message),
		},
		trace: {
			kind: "getTracePage",
			getTracePage: (filter, limit, cursor) => interceptor.getTracePage(filter, limit, cursor),
		},
	})
}
