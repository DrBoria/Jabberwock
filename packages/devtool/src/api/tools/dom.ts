import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { ExtensionBridge } from "../bridge.js"
import { wrapBridge } from "./tool-utils.js"

export function registerDomTools(mcpServer: McpServer, bridge: ExtensionBridge) {
	mcpServer.tool(
		"run_command",
		{
			command: z
				.string()
				.describe(
					'Browser JS console. Execute arbitrary JS in extension UI context. Examples: document.querySelector(".btn"), window.innerWidth, localStorage.getItem("key")',
				),
		},
		async ({ command }) => wrapBridge(() => bridge.runCommand(command)),
	)

	mcpServer.tool(
		"find_element",
		{
			selector: z
				.string()
				.describe(
					'CSS selector or text content. "*" for full DOM tree. Supports: #id, .class, [attr], button, input. Falls back to text search if CSS fails. For iframes: "iframe[src*=\\"...\\"] inner-selector" (e.g. "iframe button:nth-of-type(2)") — searches inside iframe content.',
				),
			depth: z
				.number()
				.min(1)
				.max(10)
				.optional()
				.describe("DOM serialization depth (1-10). Default: 10 for '*', 3 for specifics."),
			maxChildren: z
				.number()
				.min(1)
				.max(10)
				.optional()
				.describe("Max children per node (1-10). Default: 10. Truncates wide lists."),
			command: z
				.string()
				.optional()
				.describe(
					'JS to run on matched element. Use "$0" to reference it. E.g. "$0.click()", "$0.value = \\"hello\\""',
				),
		},
		async ({ selector, depth, maxChildren, command }) =>
			wrapBridge(() => bridge.findElement(selector, depth, maxChildren, command)),
	)

	mcpServer.tool(
		"click_element",
		{
			id: z.string().optional().describe("Element ID (prefer selector over id)"),
			selector: z
				.string()
				.optional()
				.describe(
					"CSS selector. For iframes: \"iframe[src*='...'] button:nth-of-type(N)\". For standard elements: button, a, input, select — uses native .click(). For custom components: dispatches pointerdown→pointerup→mousedown→mouseup→click chain + aria-controls popover toggle.",
				),
		},
		async ({ id, selector }) => wrapBridge(() => bridge.clickElement(id, selector)),
	)

	mcpServer.tool(
		"scroll_element",
		{
			id: z.string().optional().describe("Element ID (prefer selector)"),
			direction: z.enum(["up", "down", "left", "right"]).describe("Scroll direction"),
			selector: z.string().optional().describe("CSS selector. For iframes: \"iframe[src*='...'] .content\"."),
		},
		async ({ id, direction, selector }) => wrapBridge(() => bridge.scrollElement(id, direction, selector)),
	)

	mcpServer.tool(
		"type_text",
		{
			id: z.string().optional().describe("Element ID (prefer selector)"),
			selector: z.string().optional().describe("CSS selector of target input/textarea"),
			text: z.string().describe("Text to type"),
			submit: z.boolean().optional().describe("Press Enter after typing (form submission)"),
		},
		async ({ id, selector, text, submit }) => wrapBridge(() => bridge.typeText(id, selector, text, submit)),
	)

	mcpServer.tool(
		"select_option",
		{
			id: z.string().describe("Select element ID"),
			value: z.string().describe("Option value to select"),
		},
		async ({ id, value }) => wrapBridge(() => bridge.selectOption(id, value)),
	)

	mcpServer.tool("get_screenshot", {}, async () => wrapBridge(() => bridge.getScreenshot()))

	mcpServer.tool(
		"drag_element",
		{
			selector: z.string().describe("CSS selector of element to drag"),
			direction: z.enum(["l", "r", "t", "b"]).describe("Direction: l=left, r=right, t=up, b=down"),
			pixels: z.number().describe("Pixels to drag"),
		},
		async ({ selector, direction, pixels }) => wrapBridge(() => bridge.dragElement(selector, direction, pixels)),
	)

	mcpServer.tool(
		"drag_from_to",
		{
			from: z
				.object({
					l: z.number().optional().describe("Left px"),
					t: z.number().optional().describe("Top px"),
					r: z.number().optional().describe("Right px"),
					b: z.number().optional().describe("Bottom px"),
				})
				.describe("Start {l,t,r,b}"),
			to: z
				.object({
					l: z.number().optional().describe("Left px"),
					t: z.number().optional().describe("Top px"),
					r: z.number().optional().describe("Right px"),
					b: z.number().optional().describe("Bottom px"),
				})
				.describe("End {l,t,r,b}"),
		},
		async ({ from, to }) => wrapBridge(() => bridge.dragFromTo(from, to)),
	)
}
