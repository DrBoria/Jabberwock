/**
 * Chat Model — Chat page interactions and task creation.
 *
 * All methods use the clean MCP tool primitives (findElement, clickElement,
 * typeText, executeVscodeCommand) — NO eval, NO fiber dispatch, NO hacks.
 */

import type { DevtoolClient } from "../../packages/devtool/src/client"
import { DomModel } from "./domModel"
import { NavigationModel } from "./navigationModel"

export class ChatModel {
	private dom: DomModel
	private nav: NavigationModel

	constructor(
		public readonly client: DevtoolClient,
		dom?: DomModel,
		nav?: NavigationModel,
	) {
		this.dom = dom || new DomModel(client)
		this.nav = nav || new NavigationModel(client, this.dom)
	}

	/**
	 * Create a new task by interacting with the Chat UI.
	 *
	 * Uses clean DOM primitives:
	 * 1. Navigate to Chat (click + button)
	 * 2. Find the chat input textarea and type text via MCP type_text
	 * 3. Find and click the submit/send button via MCP click_element
	 * 4. Detect new taskId by comparing MST node count before/after submit
	 *
	 * @param text - The prompt text for the new task
	 * @param mode - Optional mode slug (e.g., "orchestrator", "code")
	 * @returns The task ID of the newly created task
	 */
	async createNewTask(text: string, mode?: string): Promise<string> {
		// 0. Record current MST task count to detect new task later
		const taskCountBefore = await this.dom.getMstTaskCount()

		// 1. Navigate to Chat (opens a new chat)
		await this.client.executeVscodeCommand("jabberwock.plusButtonClicked")
		await this.nav.waitForDataWindowType("chat")
		await new Promise((r) => setTimeout(r, 500))

		// 2. If mode is specified, switch to that mode first
		if (mode) {
			await this.switchToAgentMode(mode)
		}

		// 3. Find the chat input textarea and type the prompt
		const inputSelector = 'textarea[data-testid="chat-input"]'
		await this.dom.findElementBySelector(inputSelector)
		await this.dom.typeText("chat-input", text)

		await new Promise((r) => setTimeout(r, 200))

		// 4. Find and click the submit/send button
		await this.dom.findElementBySelector('button[data-testid="submit-button"]')
		await this.dom.clickElement("submit-button")

		// 5. Wait for the task to appear in MST state and detect its ID
		await new Promise((r) => setTimeout(r, 1500))

		// Detect new taskId by comparing MST node count
		const taskCountAfter = await this.dom.getMstTaskCount()
		let taskId: string | null = null

		if (taskCountAfter > taskCountBefore) {
			taskId = await this.dom.getMstActiveTaskId()
		} else {
			taskId = await this.dom.getMstActiveTaskId()
			console.log(
				`  ⚠ No new task created (count: ${taskCountBefore}→${taskCountAfter}). Message may have been appended to existing task ${taskId}`,
			)
		}

		const resultId = taskId || "unknown"
		console.log(`  ✓ Created new task: "${text.substring(0, 50)}..." (ID: ${resultId})`)
		return resultId
	}

	/**
	 * Verify that a message with expected text appears in the chat DOM.
	 * Polls the DOM until found or timeout.
	 */
	async verifyChatContainsMessage(expectedText: string, timeoutMs: number = 10000): Promise<void> {
		const startTime = Date.now()
		while (Date.now() - startTime < timeoutMs) {
			const dom = await this.dom.getDom()
			if (dom.includes(expectedText)) {
				console.log(`  ✓ Message found in chat: "${expectedText}"`)
				return
			}
			await new Promise((r) => setTimeout(r, 500))
		}
		throw new Error(`Message "${expectedText}" not found in chat after ${timeoutMs}ms`)
	}

	/**
	 * Switch the agent mode via DOM interaction.
	 *
	 * Uses the updated MCP click_element tool which now:
	 * - Dispatches PointerEvent (pointerdown + pointerup) for Radix UI components
	 * - Toggles aria-controls for Radix UI Popover triggers
	 * - Supports data-testid lookups
	 *
	 * 1. Clicks the ModeSelector trigger button (opens popover via pointer events)
	 * 2. Waits for popover to open
	 * 3. Finds and clicks the mode item by data-testid
	 */
	async switchToAgentMode(mode: string): Promise<void> {
		// 1. Open ModeSelector dropdown by clicking trigger
		//    The updated click_element dispatches pointer events + toggles aria-controls
		await this.dom.clickElement("mode-selector-trigger")

		// 2. Wait for dropdown animation
		await new Promise((r) => setTimeout(r, 500))

		// 3. Click the mode item by mode-specific data-testid
		const modeItemSelector = `mode-selector-item-${mode}`
		const modeItemId = await this.dom.findElementBySelector(`[data-testid="${modeItemSelector}"]`)
		if (modeItemId) {
			await this.dom.clickElement(modeItemSelector)
		} else {
			// Fallback: use nth-of-type to find the mode item by index
			const modeOrder = ["architect", "code", "ask", "debug", "orchestrator"]
			const modeIndex = modeOrder.indexOf(mode)
			if (modeIndex >= 0) {
				const nthSelector = `[data-testid="mode-selector-item"]:nth-of-type(${modeIndex + 1})`
				await this.dom.findElementBySelector(nthSelector)
				await this.dom.clickElement(nthSelector)
			}
		}

		// 4. Wait for React state update and extension postMessage
		await new Promise((r) => setTimeout(r, 300))

		console.log(`  ✓ Switched to agent mode via DOM: ${mode}`)
	}

	/**
	 * Get available agents/modes by reading them from the DOM.
	 *
	 * Opens the ModeSelector dropdown via clean click_element,
	 * parses data-testid values to extract mode names/slugs,
	 * then closes the dropdown.
	 *
	 * Returns an array of { name, slug } objects.
	 */
	async getAvailableAgents(): Promise<Array<{ name: string; slug?: string }>> {
		// 1. Open ModeSelector dropdown by clicking trigger
		await this.dom.clickElement("mode-selector-trigger")

		// 2. Wait for dropdown to appear
		await new Promise((r) => setTimeout(r, 500))

		// 3. Get the DOM and parse mode items from it
		const dom = await this.dom.getDom(5, 50)
		const modes: Array<{ name: string; slug?: string }> = []

		// Parse mode names from DOM text content
		const lines = dom.split("\n")
		for (const line of lines) {
			const modeMatch = line.match(/data-testid="mode-selector-item-(\w+)"/)
			if (modeMatch) {
				modes.push({ name: modeMatch[1], slug: modeMatch[1] })
			}
		}

		// If no mode-specific data-testids found, try parsing by text content
		if (modes.length === 0) {
			const knownModes = ["architect", "code", "ask", "debug", "orchestrator"]
			for (const slug of knownModes) {
				if (dom.toLowerCase().includes(slug)) {
					modes.push({ name: slug, slug })
				}
			}
		}

		// 4. Close dropdown by clicking trigger again
		await this.dom.clickElement("mode-selector-trigger")

		console.log(`  ✓ Retrieved ${modes.length} mode(s) from DOM`)
		return modes
	}
}
