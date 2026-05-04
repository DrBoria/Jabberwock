/**
 * DOM Model — Core DOM interaction primitives.
 *
 * All methods are implemented via DevtoolClient primitives (getDom, findElement,
 * clickElement, typeText, runCommand) — NO interceptor usage.
 *
 * This is the lowest-level model; all other models build on top of it.
 */

import type { DevtoolClient } from "../../packages/devtool/src/client"

export class DomModel {
	constructor(public readonly client: DevtoolClient) {}

	/**
	 * Get the DOM structure of the webview.
	 */
	async getDom(maxDepth?: number, maxChildren?: number): Promise<string> {
		return this.client.getDom(maxDepth, maxChildren)
	}

	/**
	 * Find a DOM element by its text content.
	 */
	async findElementByText(text: string): Promise<string> {
		return this.client.findElement(text)
	}

	/**
	 * Find a DOM element by CSS selector.
	 */
	async findElementBySelector(selector: string): Promise<string> {
		return this.client.findElement(selector)
	}

	/**
	 * Find a DOM element by its ID.
	 */
	async findElementById(id: string): Promise<string> {
		return this.client.findElement(id)
	}

	/**
	 * Click a DOM element.
	 * Uses the MCP click_element tool which now supports:
	 * - DOM id attribute
	 * - data-testid value
	 * - $N references from findElement (e.g., "$1")
	 * - CSS selectors
	 * - Pointer event dispatching (for Radix UI / ShadCN components)
	 */
	async clickElement(id: string): Promise<string> {
		return this.client.clickElement(id)
	}

	/**
	 * Type text into a DOM element.
	 * Uses the MCP type_text tool which now supports:
	 * - DOM id attribute
	 * - data-testid value
	 * - $N references from findElement
	 * - React controlled inputs (native value setter)
	 * - contenteditable elements
	 */
	async typeText(id: string, text: string): Promise<string> {
		return this.client.typeText(id, text)
	}

	/**
	 * Get the active task ID from MST chatStore via getMstState.
	 */
	async getMstActiveTaskId(): Promise<string | null> {
		const state = await this.client.getMstState({
			store: "chatStore",
			mode: "query",
			path: "activeNodeId.id",
		})
		if (typeof state === "string") {
			return state
		}
		return null
	}

	/**
	 * Get the active task's mode from MST chatStore.
	 */
	async getMstActiveTaskMode(): Promise<string | null> {
		const state = await this.client.getMstState({
			store: "chatStore",
			mode: "query",
			path: "activeNodeId.mode",
		})
		if (typeof state === "string") {
			return state
		}
		return null
	}

	/**
	 * Get the count of task nodes in MST chatStore.
	 */
	async getMstTaskCount(): Promise<number> {
		const count = await this.client.getMstState({
			store: "chatStore",
			mode: "query",
			path: "nodes.size",
		})
		return typeof count === "number" ? count : 0
	}

	/**
	 * Scroll a DOM element in a direction.
	 */
	async scrollElement(id: string, direction: "up" | "down" | "left" | "right"): Promise<string> {
		return this.client.scrollElement(id, direction)
	}

	/**
	 * Select an option in a DOM select element.
	 */
	async selectOption(id: string, value: string): Promise<string> {
		return this.client.selectOption(id, value)
	}

	/**
	 * @deprecated Use client.executeVscodeCommand() instead.
	 */
	async executeVscodeCommandViaDom(_cmdId: string, _args?: unknown): Promise<void> {
		throw new Error(
			"executeVscodeCommandViaDom is deprecated. Use client.executeVscodeCommand() instead. " +
				"The acquireVsCodeApi() approach in eval context fails because VS Code API " +
				"can only be acquired once per webview instance.",
		)
	}
}
