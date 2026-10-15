/**
 * Backend interceptor MCP tools.
 *
 * The backend {@link MessageInterceptor} sits on the EXTENSION-HOST side of the
 * webview message channel: `sendMessage` is hooked into the host's
 * `postMessageToWebview` and `receiveMessage` into the host's webview message
 * listener. The six tools (send, set/remove interceptor, list, trace, clear)
 * are registered through the shared {@link registerInterceptorTools} selector.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { MessageInterceptor } from "../../mcp/interceptor/index.js"
import { registerInterceptorTools } from "../../mcp/interceptor/tools.js"

export function registerBackendInterceptorTools(mcpServer: McpServer, interceptor: MessageInterceptor): void {
	registerInterceptorTools(mcpServer, interceptor, {
		directions: { send: "backend→webview", receive: "webview→backend" },
		sendTool: {
			name: "send_message_to_webview",
			description: "Send a message from the extension host to the webview through the interceptor",
			send: (message) => interceptor.sendMessage(message),
		},
		trace: { kind: "getTrace", getTrace: (filter, limit) => interceptor.getTrace(filter, limit) },
	})
}
