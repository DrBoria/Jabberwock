/**
 * DOM Model — Core DOM interaction primitives.
 *
 * All methods are implemented via DevtoolClient primitives (findElement,
 * clickElement, typeText, runCommand) — NO interceptor usage.
 *
 * This is the lowest-level model; all other models build on top of it.
 */

import type { DevtoolClient } from "../../packages/devtool/src/client"

export class DomModel {
	constructor(public readonly client: DevtoolClient) {}

	/**
	 * Find a DOM element by its text content.
	 * Optionally accepts depth/maxChildren for DOM tree depth control,
	 * and a command to execute on the found element (use $0 as the element reference).
	 */
	async findElementByText(text: string, depth?: number, maxChildren?: number, command?: string): Promise<string> {
		const result = await this.client.findElement(text, depth, maxChildren, command)
		return typeof result === "string" ? result : JSON.stringify(result, null, 2)
	}

	/**
	 * Find a DOM element by CSS selector.
	 * Optionally accepts depth/maxChildren for DOM tree depth control,
	 * and a command to execute on the found element (use $0 as the element reference).
	 */
	async findElementBySelector(
		selector: string,
		depth?: number,
		maxChildren?: number,
		command?: string,
	): Promise<string> {
		const result = await this.client.findElement(selector, depth, maxChildren, command)
		return typeof result === "string" ? result : JSON.stringify(result, null, 2)
	}

	/**
	 * Find a DOM element by its ID.
	 * Optionally accepts depth/maxChildren for DOM tree depth control,
	 * and a command to execute on the found element (use $0 as the element reference).
	 */
	async findElementById(id: string, depth?: number, maxChildren?: number, command?: string): Promise<string> {
		const result = await this.client.findElement(id, depth, maxChildren, command)
		return typeof result === "string" ? result : JSON.stringify(result, null, 2)
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
		return this.client.typeText(id, undefined, text)
	}

	/**
	 * Get the active task ID from the frontend (webview) MST store via getStoreState.
	 */
	async getMstActiveTaskId(): Promise<string | null> {
		const state = await this.client.getStoreState({
			store: "frontend",
			path: "chat.tree.activeNodeId",
		})
		if (state && typeof state === "object") {
			const record = state as Record<string, unknown>
			const items = record.items as Array<Record<string, unknown>> | undefined
			const value = items?.[0]?.value
			if (typeof value === "string") {
				return value
			}
		}
		return null
	}

	/**
	 * Get the active task's mode from MST chatStore.
	 */
	async getMstActiveTaskMode(): Promise<string | null> {
		const activeTaskId = await this.getMstActiveTaskId()
		if (!activeTaskId) return null

		const state = await this.client.getStoreState({
			store: "frontend",
			path: `chat.tree.nodes.${activeTaskId}.mode`,
		})
		if (state && typeof state === "object") {
			const record = state as Record<string, unknown>
			const items = record.items as Array<Record<string, unknown>> | undefined
			const value = items?.[0]?.value
			if (typeof value === "string") {
				return value
			}
		}
		return null
	}

	/**
	 * Get the count of task nodes from the frontend (webview) MST store via getStoreState.
	 */
	async getMstTaskCount(): Promise<number> {
		const state = await this.client.getStoreState({
			store: "frontend",
			path: "chat.tree.nodes",
		})
		if (state && typeof state === "object") {
			const record = state as Record<string, unknown>
			const total = record.total as number | undefined
			if (typeof total === "number") {
				return total
			}
		}
		return 0
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
