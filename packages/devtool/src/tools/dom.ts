import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { ExtensionBridge } from "../bridge.js"

/**
 * Register DOM interaction tools on the MCP server.
 * These tools provide Playwright-style DOM querying and interaction,
 * allowing agents to find elements, click, scroll, type, and select
 * in the extension's webview UI.
 */
export function registerDomTools(mcpServer: McpServer, bridge: ExtensionBridge) {
	mcpServer.tool(
		"run_command",
		{
			command: z
				.string()
				.describe(
					'Browser console in the webview. Execute arbitrary JavaScript in the extension UI context (like Chrome DevTools console). Examples: document.querySelector(".btn"), window.innerWidth, localStorage.getItem("key"), document.title, navigator.userAgent. Also supports $1.click(), $2.textContent on elements stored by find_element.',
				),
		},
		async ({ command }) => {
			try {
				const result = await bridge.runCommand(command)
				return { content: [{ type: "text", text: result }] }
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` },
					],
					isError: true,
				}
			}
		},
	)

	mcpServer.tool(
		"get_dom",
		{
			maxDepth: z
				.number()
				.optional()
				.describe("Maximum DOM depth to return (default: unlimited). Use lower values for a shallow overview."),
			maxChildren: z
				.number()
				.optional()
				.describe("Max children per node to show (default: all). Truncates wide nodes."),
		},
		async ({ maxDepth, maxChildren }) => {
			try {
				const dom = await bridge.getDom(maxDepth, maxChildren)
				return { content: [{ type: "text", text: dom }] }
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` },
					],
					isError: true,
				}
			}
		},
	)

	mcpServer.tool(
		"find_element",
		{
			selector: z
				.string()
				.describe(
					'CSS selector or text to find. Supports all CSS selectors: #id, .class, [data-testid="x"], [name="y"], button, input, etc. Also falls back to text content search if the selector doesn\'t match a DOM element.',
				),
		},
		async ({ selector }) => {
			try {
				const result = await bridge.findElement(selector)
				return { content: [{ type: "text", text: result }] }
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` },
					],
					isError: true,
				}
			}
		},
	)

	mcpServer.tool(
		"click_element",
		{
			id: z.string().describe("The DOM element ID to click"),
		},
		async ({ id }) => {
			try {
				const result = await bridge.clickElement(id)
				return { content: [{ type: "text", text: result }] }
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` },
					],
					isError: true,
				}
			}
		},
	)

	mcpServer.tool(
		"scroll_element",
		{
			id: z.string().describe("The DOM element ID to scroll"),
			direction: z
				.enum(["up", "down", "left", "right"])
				.describe("Direction to scroll: up, down, left, or right"),
		},
		async ({ id, direction }) => {
			try {
				const result = await bridge.scrollElement(id, direction)
				return { content: [{ type: "text", text: result }] }
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` },
					],
					isError: true,
				}
			}
		},
	)

	mcpServer.tool(
		"type_text",
		{
			id: z.string().describe("The DOM element ID to type into (e.g. input, textarea)"),
			text: z.string().describe("The text to type into the element"),
		},
		async ({ id, text }) => {
			try {
				const result = await bridge.typeText(id, text)
				return { content: [{ type: "text", text: result }] }
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` },
					],
					isError: true,
				}
			}
		},
	)

	mcpServer.tool(
		"select_option",
		{
			id: z.string().describe("The DOM select element ID"),
			value: z.string().describe("The option value to select"),
		},
		async ({ id, value }) => {
			try {
				const result = await bridge.selectOption(id, value)
				return { content: [{ type: "text", text: result }] }
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` },
					],
					isError: true,
				}
			}
		},
	)

	mcpServer.tool("get_screenshot", {}, async () => {
		try {
			const result = await bridge.getScreenshot()
			return { content: [{ type: "text", text: result }] }
		} catch (error) {
			return {
				content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
				isError: true,
			}
		}
	})

	mcpServer.tool(
		"drag_element",
		{
			selector: z.string().describe("CSS selector of the element to drag"),
			direction: z
				.enum(["l", "r", "t", "b"])
				.describe("Direction to drag: l (left), r (right), t (top/up), b (bottom/down)"),
			pixels: z.number().describe("Number of pixels to drag in the given direction"),
		},
		async ({ selector, direction, pixels }) => {
			try {
				const result = await bridge.dragElement(selector, direction, pixels)
				return { content: [{ type: "text", text: result }] }
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` },
					],
					isError: true,
				}
			}
		},
	)

	mcpServer.tool(
		"drag_from_to",
		{
			from: z
				.object({
					l: z.number().optional().describe("Left coordinate in pixels"),
					t: z.number().optional().describe("Top coordinate in pixels"),
					r: z.number().optional().describe("Right coordinate in pixels"),
					b: z.number().optional().describe("Bottom coordinate in pixels"),
				})
				.describe("Starting position (l=left, t=top, r=right, b=bottom)"),
			to: z
				.object({
					l: z.number().optional().describe("Left coordinate in pixels"),
					t: z.number().optional().describe("Top coordinate in pixels"),
					r: z.number().optional().describe("Right coordinate in pixels"),
					b: z.number().optional().describe("Bottom coordinate in pixels"),
				})
				.describe("Ending position (l=left, t=top, r=right, b=bottom)"),
		},
		async ({ from, to }) => {
			try {
				const result = await bridge.dragFromTo(from, to)
				return { content: [{ type: "text", text: result }] }
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` },
					],
					isError: true,
				}
			}
		},
	)
}
