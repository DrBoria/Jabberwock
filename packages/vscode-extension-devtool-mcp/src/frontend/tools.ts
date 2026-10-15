import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { DevtoolMethods } from "../mcp/server.js"

/**
 * Frontend domain tools.
 *
 * Owns the webview-facing tools: DOM interaction, screenshots and page info.
 * The frontend (webview) may be absent — a purely backend extension has no
 * webview surface. When it is, these tools still register (they are the
 * canonical frontend tools) but their calls degrade gracefully: the DOM
 * round-trip times out / returns an empty envelope, and the agent sees a clear
 * "frontend unavailable" error rather than a crash.
 *
 * The env-aware console tools (`get_console` / `search_console`) live in the
 * backend domain (`backend/console.ts`) and already handle the `env: "frontend"`
 * path by delegating to the frontend bridge — so they are NOT re-registered here.
 * The frontend interceptor tools (`frontend_*`) live in
 * `frontend/interceptor/tools.ts` and are registered by the DevtoolServer when
 * a `FrontendMessageInterceptor` is provided.
 */
export function registerFrontendTools(mcpServer: McpServer, methods: DevtoolMethods): void {
	registerDomTools(mcpServer, methods)
	registerScreenshotTools(mcpServer, methods)
}

/** Every frontend tool is a JSON round-trip through the webview. */
const call =
	(methods: DevtoolMethods, fn: (args: Record<string, unknown>) => Promise<string>) =>
	async (args: Record<string, unknown>) => {
		try {
			const result = await fn(args)
			return { content: [{ type: "text" as const, text: result }] }
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			return {
				content: [{ type: "text" as const, text: `Error: ${message}` }],
				isError: true,
			}
		}
	}

const idOrSelector = {
	id: z.string().optional().describe("Element id (from a prior find_element)"),
	selector: z.string().optional().describe("CSS selector"),
}

const direction = z.enum(["up", "down", "left", "right"]).optional().describe("Direction")

function registerDomTools(mcpServer: McpServer, methods: DevtoolMethods): void {
	mcpServer.tool(
		"run_command",
		"Run a Playwright locator command (e.g. 'page.click', 'page.fill') in the webview",
		{ command: z.string().describe("The Playwright locator command to run (e.g. 'page.click', 'page.fill')") },
		call(methods, (args) => methods.runCommand(String(args.command ?? ""))),
	)

	mcpServer.tool(
		"find_element",
		"Find an element in the webview by CSS selector and return its serialized DOM subtree",
		{
			selector: z.string().describe("CSS selector to find the element by"),
			depth: z.number().optional().describe("Max depth of the DOM subtree to serialize"),
			maxChildren: z.number().optional().describe("Max number of children to include per node"),
			command: z.string().optional().describe("Optional Playwright locator command to run on the found element"),
		},
		call(methods, (args) =>
			methods.findElement(
				String(args.selector ?? ""),
				typeof args.depth === "number" ? args.depth : undefined,
				typeof args.maxChildren === "number" ? args.maxChildren : undefined,
				typeof args.command === "string" ? args.command : undefined,
			),
		),
	)

	mcpServer.tool(
		"click_element",
		"Click an element in the webview by element id or CSS selector",
		idOrSelector,
		call(methods, (args) =>
			methods.clickElement(
				typeof args.id === "string" ? args.id : undefined,
				typeof args.selector === "string" ? args.selector : undefined,
			),
		),
	)

	mcpServer.tool(
		"type_text",
		"Type text into an element in the webview by element id or CSS selector",
		{
			...idOrSelector,
			text: z.string().optional().describe("Text to type"),
			submit: z.boolean().optional().describe("Press Enter after typing"),
		},
		call(methods, (args) =>
			methods.typeText(
				typeof args.id === "string" ? args.id : undefined,
				typeof args.selector === "string" ? args.selector : undefined,
				typeof args.text === "string" ? args.text : undefined,
				typeof args.submit === "boolean" ? args.submit : undefined,
			),
		),
	)

	mcpServer.tool(
		"scroll_element",
		"Scroll an element in the webview by element id or CSS selector",
		{ ...idOrSelector, direction },
		call(methods, (args) =>
			methods.scrollElement(
				typeof args.id === "string" ? args.id : undefined,
				typeof args.direction === "string" ? args.direction : undefined,
				typeof args.selector === "string" ? args.selector : undefined,
			),
		),
	)

	mcpServer.tool(
		"select_option",
		"Select an option in a <select> element in the webview",
		{ ...idOrSelector, value: z.string().optional().describe("Option value to select") },
		call(methods, (args) =>
			methods.selectOption(
				typeof args.id === "string" ? args.id : undefined,
				typeof args.value === "string" ? args.value : undefined,
			),
		),
	)

	mcpServer.tool(
		"drag_element",
		"Drag an element in the webview by element id or CSS selector",
		{ ...idOrSelector, direction, pixels: z.number().optional().describe("Number of pixels to drag") },
		call(methods, (args) =>
			methods.dragElement(
				typeof args.selector === "string" ? args.selector : undefined,
				typeof args.direction === "string" ? args.direction : undefined,
				typeof args.pixels === "number" ? args.pixels : undefined,
			),
		),
	)

	mcpServer.tool(
		"drag_from_to",
		"Drag from one element to another in the webview",
		{
			from: z.record(z.unknown()).optional().describe("Source element (id or selector)"),
			to: z.record(z.unknown()).optional().describe("Target element (id or selector)"),
		},
		call(methods, (args) =>
			methods.dragFromTo(
				typeof args.from === "object" && args.from !== null
					? (args.from as Record<string, unknown>)
					: undefined,
				typeof args.to === "object" && args.to !== null ? (args.to as Record<string, unknown>) : undefined,
			),
		),
	)
}

function registerScreenshotTools(mcpServer: McpServer, methods: DevtoolMethods): void {
	mcpServer.tool(
		"get_screenshot",
		"Capture a screenshot of the active webview",
		{},
		call(methods, () => methods.getScreenshot()),
	)

	mcpServer.tool(
		"get_active_page",
		"Get information about the currently active webview page",
		{},
		call(methods, () => methods.getActivePage()),
	)
}
