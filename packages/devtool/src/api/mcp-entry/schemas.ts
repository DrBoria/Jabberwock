import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

export type ProxyToolCall = (name: string, params: Record<string, unknown>) => Promise<string>

/**
 * Convert a flat JSON Schema property descriptor to a Zod schema.
 * Handles type mapping, optional, default, and description.
 */
function propToZod(prop: Record<string, unknown>): z.ZodType {
	const type = prop.type as string
	let zType: z.ZodType
	switch (type) {
		case "string":
			zType = z.string()
			break
		case "number":
			zType = z.number()
			break
		case "boolean":
			zType = z.boolean()
			break
		case "any":
		case "unknown":
			zType = z.any()
			break
		default:
			zType = z.any()
			break
	}
	if (typeof prop.description === "string") {
		zType = zType.describe(prop.description)
	}
	if (prop.optional) {
		zType = zType.optional()
	}
	if (prop.defaultValue !== undefined) {
		zType = zType.default(prop.defaultValue)
	}
	return zType
}

export function registerAllTools(server: McpServer, proxyToolCall: ProxyToolCall): void {
	function registerTool(server: McpServer, name: string, description: string, schema: Record<string, unknown>) {
		// Convert flat JSON Schema properties to Zod schemas so the MCP SDK's
		// isZodRawShape() check passes (it requires ZodTypeLike values).
		// Without this, all parameterized tools appear parameterless to the client.
		const zodShape: Record<string, z.ZodType> = {}
		for (const [key, value] of Object.entries(schema)) {
			zodShape[key] = propToZod(value as Record<string, unknown>)
		}

		server.tool(name, description, zodShape, async (params) => {
			try {
				const result = await proxyToolCall(name, (params ?? {}) as Record<string, unknown>)
				return { content: [{ type: "text", text: result }] }
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` },
					],
					isError: true,
				}
			}
		})
	}

	// ── No-param tools ──
	// ── No-param tools ──

	registerTool(server, "get_extension_info", "Get extension metadata: name, version, available stores", {})
	registerTool(
		server,
		"get_current_state",
		"Get current extension state summary (chat, settings, foundation store keys)",
		{},
	)
	registerTool(server, "get_active_page", "Get the currently active page in the extension's webview", {})
	registerTool(server, "get_screenshot", "Take a screenshot of the extension's webview", {})
	registerTool(server, "clear_diagnostics", "Clear all diagnostic logs", {})

	// ── Console / diagnostics tools ──

	registerTool(server, "get_console", "Get console logs from backend or frontend", {
		env: { type: "string" as const, description: "'backend' or 'frontend'" },
		level: { type: "string" as const, description: "Filter by log level: error/warn/info/debug", optional: true },
		search: { type: "string" as const, description: "Text search within log messages", optional: true },
		limit: { type: "number" as const, description: "Max entries", defaultValue: 10 },
		cursor: { type: "number" as const, description: "Entries to skip from end", defaultValue: 0 },
	})

	registerTool(server, "search_console", "Search console logs by text content across backend or frontend", {
		query: { type: "string" as const, description: "Text to search for" },
		env: { type: "string" as const, description: "'backend' or 'frontend'", optional: true },
		level: { type: "string" as const, description: "Filter by log level", optional: true },
		limit: { type: "number" as const, description: "Max entries per env", defaultValue: 10 },
		cursor: { type: "number" as const, description: "Entries to skip from end", defaultValue: 0 },
	})

	registerTool(server, "get_logs", "Get diagnostic logs from the extension", {
		lines: { type: "number" as const, description: "Number of recent lines", defaultValue: 100 },
	})

	registerTool(server, "get_diagnostics_snapshot", "Get a diagnostics snapshot with optional filtering", {
		limit: { type: "number" as const, description: "Max log entries", optional: true },
		offset: { type: "number" as const, description: "Skip N entries", optional: true },
		level: { type: "string" as const, description: "Filter by level", optional: true },
		search: { type: "string" as const, description: "Filter by substring", optional: true },
	})

	// ── DOM interaction tools ──

	registerTool(server, "run_command", "Execute arbitrary JavaScript in the extension's webview context", {
		command: { type: "string" as const, description: "JavaScript to execute" },
	})

	registerTool(server, "find_element", "Find DOM element by CSS selector or text", {
		selector: { type: "string" as const, description: "CSS selector, text content, or '*'" },
		depth: { type: "number" as const, description: "DOM serialization depth", optional: true },
		maxChildren: { type: "number" as const, description: "Max children per node", optional: true },
		command: { type: "string" as const, description: "JS to run on matched element", optional: true },
	})

	registerTool(server, "click_element", "Click a DOM element by id or CSS selector", {
		id: { type: "string" as const, description: "Element ID", optional: true },
		selector: { type: "string" as const, description: "CSS selector", optional: true },
	})

	registerTool(server, "type_text", "Type text into an input element", {
		id: { type: "string" as const, description: "Element ID", optional: true },
		selector: { type: "string" as const, description: "CSS selector", optional: true },
		text: { type: "string" as const, description: "Text to type" },
		submit: { type: "boolean" as const, description: "Press Enter after typing", optional: true },
	})

	registerTool(server, "scroll_element", "Scroll a DOM element in a direction", {
		id: { type: "string" as const, description: "Element ID", optional: true },
		direction: { type: "string" as const, description: "up/down/left/right" },
		selector: { type: "string" as const, description: "CSS selector", optional: true },
	})

	registerTool(server, "select_option", "Select an option in a select element", {
		id: { type: "string" as const, description: "Select element ID" },
		value: { type: "string" as const, description: "Option value to select" },
	})

	registerTool(server, "execute_vscode_command", "Execute a VS Code command in the extension host", {
		command: { type: "string" as const, description: "VS Code command ID" },
		args: { type: "unknown" as const, description: "Optional arguments", optional: true },
	})

	// ── State / store tools ──

	registerTool(server, "get_store_state", "Inspect extension state stores (backend or frontend)", {
		env: { type: "string" as const, description: "'backend' or 'frontend'" },
		store: { type: "string" as const, description: "Store name or dot-separated path", optional: true },
		path: { type: "string" as const, description: "Path within the store to query", optional: true },
		limit: { type: "number" as const, description: "Items per page", defaultValue: 10 },
		cursor: { type: "number" as const, description: "Pagination cursor", defaultValue: 0 },
		fields: { type: "string" as const, description: "Comma-separated field names to extract", optional: true },
	})

	registerTool(server, "search_state", "Search extension state by content/ID/text", {
		env: { type: "string" as const, description: "'backend' or 'frontend'" },
		query: { type: "string" as const, description: "Search query" },
		store: { type: "string" as const, description: "Optional specific store to search within", optional: true },
		limit: { type: "number" as const, description: "Maximum results", defaultValue: 10 },
		cursor: { type: "number" as const, description: "Pagination cursor", defaultValue: 0 },
	})

	registerTool(server, "get_store_actions", "List available store actions (backend or frontend)", {
		env: { type: "string" as const, description: "'backend' or 'frontend'" },
		limit: { type: "number" as const, description: "Items per page", defaultValue: 10 },
		cursor: { type: "number" as const, description: "Pagination cursor", defaultValue: 0 },
	})

	registerTool(server, "filter_actions", "Filter store actions by pattern", {
		env: { type: "string" as const, description: "'backend' or 'frontend'" },
		pattern: { type: "string" as const, description: "Action name pattern to filter by" },
		limit: { type: "number" as const, description: "Items per page", defaultValue: 10 },
		cursor: { type: "number" as const, description: "Pagination cursor", defaultValue: 0 },
	})

	registerTool(server, "search_actions", "Search store actions by query", {
		env: { type: "string" as const, description: "'backend' or 'frontend'" },
		query: { type: "string" as const, description: "Search query for action names" },
		limit: { type: "number" as const, description: "Items per page", defaultValue: 10 },
		cursor: { type: "number" as const, description: "Pagination cursor", defaultValue: 0 },
	})

	registerTool(server, "count_actions", "Count store actions", {
		env: { type: "string" as const, description: "'backend' or 'frontend'" },
	})

	registerTool(server, "get_store_actions_log", "Get store actions log (timestamped action history)", {
		env: { type: "string" as const, description: "'backend' or 'frontend'" },
		limit: { type: "number" as const, description: "Items per page", defaultValue: 10 },
		cursor: { type: "number" as const, description: "Pagination cursor", defaultValue: 0 },
	})

	// ── State undo/redo tools ──

	registerTool(server, "apply_previous_state", "Undo to previous store state snapshot", {
		env: { type: "string" as const, description: "'backend' or 'frontend'" },
	})

	registerTool(server, "apply_next_state", "Redo to next store state snapshot", {
		env: { type: "string" as const, description: "'backend' or 'frontend'" },
	})

	// ── Advanced DOM interaction tools ──

	registerTool(server, "drag_element", "Drag a DOM element in a direction by pixels", {
		selector: { type: "string" as const, description: "CSS selector of element to drag" },
		direction: { type: "string" as const, description: "Direction: l=left, r=right, t=up, b=down" },
		pixels: { type: "number" as const, description: "Pixels to drag" },
	})

	registerTool(server, "drag_from_to", "Drag from one set of coordinates to another", {
		from: {
			type: "object" as const,
			description: "Start {l,t,r,b}",
			properties: {
				l: { type: "number" as const, optional: true },
				t: { type: "number" as const, optional: true },
				r: { type: "number" as const, optional: true },
				b: { type: "number" as const, optional: true },
			},
		},
		to: {
			type: "object" as const,
			description: "End {l,t,r,b}",
			properties: {
				l: { type: "number" as const, optional: true },
				t: { type: "number" as const, optional: true },
				r: { type: "number" as const, optional: true },
				b: { type: "number" as const, optional: true },
			},
		},
	})

	// ── Event bus / messaging tools ──

	registerTool(server, "send_message_to_webview", "Send a message to the extension's webview", {
		type: { type: "string" as const, description: "Message type (e.g. 'action', 'command')" },
		action: { type: "string" as const, description: "Action/command name (e.g. 'chatButtonClicked')" },
		payload: { type: "any" as const, description: "Optional payload", optional: true },
	})

	registerTool(server, "set_message_interceptor", "Set a mock response interceptor for webview messages", {
		direction: { type: "string" as const, description: "Direction: 'backend→webview' or 'webview→backend'" },
		type: { type: "string" as const, description: "Message type to match" },
		action: { type: "string" as const, description: "Optional action name to match", optional: true },
		response: { type: "any" as const, description: "Mock response to return when intercepted" },
	})

	registerTool(server, "remove_message_interceptor", "Remove a message interceptor by direction/type/action", {
		direction: { type: "string" as const, description: "Direction of the interceptor to remove" },
		type: { type: "string" as const, description: "Message type of the interceptor to remove" },
		action: { type: "string" as const, description: "Optional action name", optional: true },
	})

	registerTool(server, "get_active_interceptors", "Get all active message interceptors", {})

	registerTool(server, "get_message_trace", "Get recent intercepted message trace", {
		direction: { type: "string" as const, description: "Filter by direction", optional: true },
		type: { type: "string" as const, description: "Filter by message type", optional: true },
		action: { type: "string" as const, description: "Filter by action name", optional: true },
	})

	registerTool(server, "clear_message_trace", "Clear the message trace log", {})
}
