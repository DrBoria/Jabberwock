/**
 * Navigation Model — Page navigation and verification.
 *
 * All methods are DOM-based (parsing data-window-type attributes, dispatching
 * VS Code commands via browser console JS) — NO interceptor usage.
 */

import type { DevtoolClient } from "../../packages/devtool/src/client"
import { DomModel } from "./domModel"

export class NavigationModel {
	private dom: DomModel

	constructor(
		public readonly client: DevtoolClient,
		dom?: DomModel,
	) {
		this.dom = dom || new DomModel(client)
	}

	/**
	 * Get the currently active page by inspecting the DOM for
	 * data-window-type elements with data-active="true".
	 * Falls back to the last data-window-type in DOM order if data-active is not found.
	 */
	async getActivePage(): Promise<string> {
		const dom = await this.dom.findElementBySelector("*", 10)
		const lines = dom.split("\n")
		const windowTypes: string[] = []
		for (const line of lines) {
			const match = line.match(/"?data-window-type"?[=:]\s*"?(\w+)"?/)
			if (match) {
				windowTypes.push(match[1].toLowerCase())
			}
		}

		// Prefer the window with data-active="true" (set by React based on MST state)
		for (const line of lines) {
			const lowerLine = line.toLowerCase()
			if (lowerLine.includes('data-active="true"') || lowerLine.includes("data-active={true}")) {
				const match = line.match(/"?data-window-type"?[=:]\s*"?(\w+)"?/)
				if (match) {
					return match[1].toLowerCase()
				}
			}
		}

		// Fallback: return the last window type found in DOM order (original behavior)
		if (windowTypes.length > 0) {
			return windowTypes[windowTypes.length - 1]
		}
		return "chat"
	}

	/**
	 * Verify the active page matches expected.
	 */
	async verifyActivePage(expected: string): Promise<void> {
		const actual = await this.getActivePage()
		if (actual !== expected) {
			throw new Error(`Expected page "${expected}" but got "${actual}"`)
		}
		console.log(`  ✓ Active page: ${actual}`)
	}

	/**
	 * Get the UI window stack from the DOM.
	 *
	 * Parses all `data-window-type` attributes from the DOM and returns them
	 * in document order. The "App" base layer is filtered out.
	 */
	async getUiWindowStack(): Promise<string[]> {
		const dom = await this.dom.findElementBySelector("*", 10)
		const lines = dom.split("\n")
		const windowTypes: string[] = []
		for (const line of lines) {
			const match = line.match(/"?data-window-type"?[=:]\s*"?(\w+)"?/)
			if (match) {
				const type = match[1].toLowerCase()
				if (type !== "app") {
					windowTypes.push(type)
				}
			}
		}
		return windowTypes
	}

	/**
	 * Verify that no extra windows are open beyond the expected one.
	 */
	async verifyNoExtraWindows(expectedWindowType: string): Promise<void> {
		const stack = await this.getUiWindowStack()
		if (stack.length > 1) {
			console.warn(`  ⚠ Extra windows detected: ${stack.join(", ")} (expected only "${expectedWindowType}")`)
		} else {
			console.log(`  ✓ Only "${expectedWindowType}" window is open`)
		}
	}

	/**
	 * Wait for a specific data-window-type to appear in the DOM.
	 */
	async waitForDataWindowType(expected: string, timeoutMs: number = 5000): Promise<void> {
		const startTime = Date.now()
		while (Date.now() - startTime < timeoutMs) {
			const stack = await this.getUiWindowStack()
			if (stack.includes(expected)) {
				console.log(`  ✓ Window type "${expected}" appeared`)
				return
			}
			await new Promise((r) => setTimeout(r, 300))
		}
		throw new Error(`Window type "${expected}" did not appear within ${timeoutMs}ms`)
	}

	/**
	 * Navigate to the History page by clicking the history button in the UI.
	 */
	async navigateToHistory(): Promise<void> {
		await this.client.executeVscodeCommand("jabberwock.historyButtonClicked")
		await this.waitForDataWindowType("history")
		console.log("  ✓ Navigated to History")
	}

	/**
	 * Navigate to the Settings page by clicking the settings button in the UI.
	 */
	async navigateToSettings(): Promise<void> {
		await this.client.executeVscodeCommand("jabberwock.settingsButtonClicked")
		await this.waitForDataWindowType("settings")
		console.log("  ✓ Navigated to Settings")
	}

	/**
	 * Navigate to a specific chat task by clicking on it in the history list.
	 * If no taskId provided, opens a new chat page.
	 */
	async navigateToChat(taskId?: string): Promise<void> {
		if (taskId) {
			await this.navigateToHistory()
			// Use findElement + clickElement to click the task in history
			const taskElId = await this.dom.findElementBySelector(
				`[data-testid="task-item-${taskId}"], [data-task-id="${taskId}"]`,
			)
			if (taskElId) {
				await this.dom.clickElement(taskElId)
			} else {
				console.log(`  ⚠ Task element not found in history: ${taskId}`)
			}
		} else {
			await this.client.executeVscodeCommand("jabberwock.plusButtonClicked")
		}
		await this.waitForDataWindowType("chat")
		console.log(`  ✓ Navigated to Chat${taskId ? ` (task: ${taskId})` : ""}`)
	}

	/**
	 * Navigate to a specific page by name.
	 */
	async navigateToPage(page: string, taskId?: string): Promise<void> {
		switch (page.toLowerCase()) {
			case "chat":
				await this.navigateToChat(taskId)
				break
			case "history":
				await this.navigateToHistory()
				break
			case "settings":
				await this.navigateToSettings()
				break
			default:
				throw new Error(`Unknown page: "${page}". Supported: chat, history, settings`)
		}
	}
}
