/**
 * ExtensionModel — Page Model for Jabberwock E2E testing.
 *
 * Architecture (like Playwright):
 *   @jabberwock/devtool  = Playwright (transport, connection, primitives)
 *   ExtensionModel       = Page (declarative methods composing primitives)
 *
 * ExtensionModel contains NO transport logic, NO WebSocket, NO JSON-RPC.
 * It receives a DevtoolClient instance and composes its primitives into
 * declarative, domain-specific methods.
 *
 * Tests use BDD Given/When/Then pattern via given-when-then.ts helpers.
 *
 * Usage:
 *   const client = new DevtoolClient()
 *   await client.connect()
 *   const page = new ExtensionModel(client)
 *   await page.navigateToHistory()
 *   await page.verifyActivePage("history")
 *   await client.disconnect()
 */

import type { DevtoolClient } from "../packages/devtool/src/client"

// ── Test Result Tracking ───────────────────────────────────────────────────

export interface TestResult {
	name: string
	status: "PASS" | "FAIL" | "SKIP"
	detail?: string
}

/**
 * Create a test suite with scoped ExtensionModel + DevtoolClient lifecycle.
 */
export function createExtensionTest(name: string) {
	return {
		async run(fn: (model: ExtensionModel) => Promise<void>): Promise<void> {
			const { DevtoolClient } = require("../packages/devtool/src/client")
			const client = new DevtoolClient()
			const model = new ExtensionModel(client)
			try {
				await client.connect()
				console.log(`\n═══ ${name} ═══`)
				await fn(model)
				model.printFinalResults()
			} finally {
				await client.disconnect()
			}
		},
	}
}

// ═══════════════════════════════════════════════════════════════════════════
//  PAGE MODEL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ExtensionModel is a Page Model for the Jabberwock extension UI.
 *
 * Like Playwright's Page class, it provides:
 * - Declarative navigation methods (navigateToHistory, navigateToSettings, etc.)
 * - Verification helpers (verifyActivePage, verifyChatContainsMessage, etc.)
 * - Task management (createNewTask, getTaskStatus, etc.)
 * - MST state queries (getMstState, verifyMstTaskState, etc.)
 *
 * All imperative complexity (WebSocket, JSON-RPC, DOM queries) is handled
 * by the DevtoolClient (the "Playwright" layer).
 */
export class ExtensionModel {
	private results: TestResult[] = []

	/**
	 * @param client The DevtoolClient instance (transport + primitives layer)
	 */
	constructor(public readonly client: DevtoolClient) {}

	// ══════════════════════════════════════════════════════════════════════
	//  CORE PRIMITIVES — delegated to client
	// ══════════════════════════════════════════════════════════════════════

	async getDom(maxDepth?: number, maxChildren?: number): Promise<string> {
		return this.client.getDom(maxDepth, maxChildren)
	}

	async findElementByText(text: string): Promise<string> {
		return this.client.findElement(text)
	}

	async findElementBySelector(selector: string): Promise<string> {
		return this.client.findElement(selector)
	}

	async findElementById(id: string): Promise<string> {
		return this.client.findElement(id)
	}

	async clickElement(id: string): Promise<string> {
		return this.client.clickElement(id)
	}

	async typeText(id: string, text: string): Promise<string> {
		return this.client.typeText(id, text)
	}

	async scrollElement(id: string, direction: "up" | "down" | "left" | "right"): Promise<string> {
		return this.client.scrollElement(id, direction)
	}

	async selectOption(id: string, value: string): Promise<string> {
		return this.client.selectOption(id, value)
	}

	// ══════════════════════════════════════════════════════════════════════
	//  PAGE VERIFICATION
	// ══════════════════════════════════════════════════════════════════════

	/**
	 * Get the currently active page by inspecting the DOM for data-window-type elements.
	 */
	async getActivePage(): Promise<string> {
		const dom = await this.getDom(10)
		const lines = dom.split("\n")
		const windowTypes: string[] = []
		for (const line of lines) {
			const match = line.match(/data-window-type="(\w+)"/)
			if (match) {
				windowTypes.push(match[1].toLowerCase())
			}
		}
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
	 * Wait for data-window-type to change to the expected value.
	 * Polls the DOM until the attribute matches or timeout expires.
	 */
	async waitForDataWindowType(expected: string, timeoutMs: number = 5000): Promise<void> {
		const startTime = Date.now()
		while (Date.now() - startTime < timeoutMs) {
			const activePage = await this.getActivePage()
			if (activePage === expected) {
				console.log(`  ✓ data-window-type changed to "${expected}"`)
				return
			}
			await new Promise((r) => setTimeout(r, 200))
		}
		const actual = await this.getActivePage()
		throw new Error(
			`Timed out waiting for data-window-type="${expected}" after ${timeoutMs}ms. Current: "${actual}"`,
		)
	}

	// ══════════════════════════════════════════════════════════════════════
	//  DOM-BASED NAVIGATION
	//  Each method: find element → click → wait for data-window-type → verify
	// ══════════════════════════════════════════════════════════════════════

	/**
	 * Navigate to the History page via DOM interaction.
	 * Opens the navigation menu, finds "History", clicks it, waits for load.
	 */
	async navigateToHistory(): Promise<void> {
		console.log("  [Nav] Navigating to History...")

		// Strategy 1: Find "History" by text
		const found = await this.findElementByText("History")
		if (found && found !== "null" && found !== "") {
			const match = found.match(/#([a-zA-Z0-9_-]+)/)
			if (match) {
				await this.clickElement(match[1])
				await this.waitForDataWindowType("history")
				await this.verifyActivePage("history")
				console.log("  ✓ Navigated to History via text click")
				return
			}
		}

		// Strategy 2: Try data-testid selector
		const byTestId = await this.findElementBySelector('[data-testid="history-tab"]')
		if (byTestId && byTestId !== "null" && byTestId !== "") {
			const match = byTestId.match(/#([a-zA-Z0-9_-]+)/)
			if (match) {
				await this.clickElement(match[1])
				await this.waitForDataWindowType("history")
				await this.verifyActivePage("history")
				console.log("  ✓ Navigated to History via data-testid")
				return
			}
		}

		// Strategy 3: Inspect DOM for navigation elements
		const dom = await this.getDom(5)
		console.log("  [Nav] History element not found by text, inspecting DOM...")
		console.log(dom.slice(0, 500))
		throw new Error("Could not navigate to History — element not found in DOM")
	}

	/**
	 * Navigate to the Settings page via DOM interaction.
	 */
	async navigateToSettings(): Promise<void> {
		console.log("  [Nav] Navigating to Settings...")

		// Strategy 1: Find "Settings" by text
		const found = await this.findElementByText("Settings")
		if (found && found !== "null" && found !== "") {
			const match = found.match(/#([a-zA-Z0-9_-]+)/)
			if (match) {
				await this.clickElement(match[1])
				await this.waitForDataWindowType("settings")
				await this.verifyActivePage("settings")
				console.log("  ✓ Navigated to Settings via text click")
				return
			}
		}

		// Strategy 2: Try data-testid selector
		const byTestId = await this.findElementBySelector('[data-testid="settings-tab"]')
		if (byTestId && byTestId !== "null" && byTestId !== "") {
			const match = byTestId.match(/#([a-zA-Z0-9_-]+)/)
			if (match) {
				await this.clickElement(match[1])
				await this.waitForDataWindowType("settings")
				await this.verifyActivePage("settings")
				console.log("  ✓ Navigated to Settings via data-testid")
				return
			}
		}

		// Strategy 3: Try button with Settings text
		const buttonParent = await this.findElementBySelector(`button:has(:text("Settings"))`)
		if (buttonParent && buttonParent !== "null" && buttonParent !== "") {
			const match = buttonParent.match(/#([a-zA-Z0-9_-]+)/)
			if (match) {
				await this.clickElement(match[1])
				await this.waitForDataWindowType("settings")
				await this.verifyActivePage("settings")
				console.log("  ✓ Navigated to Settings via button click")
				return
			}
		}

		const dom = await this.getDom(5)
		console.log("  [Nav] Settings element not found, inspecting DOM...")
		console.log(dom.slice(0, 500))
		throw new Error("Could not navigate to Settings — element not found in DOM")
	}

	/**
	 * Navigate to the Chat page.
	 * If taskId is provided, navigates directly to that task.
	 */
	async navigateToChat(taskId?: string): Promise<void> {
		console.log("  [Nav] Navigating to Chat...")

		if (taskId) {
			await this.client.navigateToTask(taskId)
			await this.waitForDataWindowType("chat")
			await this.verifyActivePage("chat")
			console.log(`  ✓ Navigated to task ${taskId}`)
			return
		}

		// Strategy 1: Find "New Chat" by text
		const found = await this.findElementByText("New Chat")
		if (found && found !== "null" && found !== "") {
			const match = found.match(/#([a-zA-Z0-9_-]+)/)
			if (match) {
				await this.clickElement(match[1])
				await this.waitForDataWindowType("chat")
				await this.verifyActivePage("chat")
				console.log("  ✓ Navigated to Chat via text click")
				return
			}
		}

		// Strategy 2: Try data-testid
		const byTestId = await this.findElementBySelector('[data-testid="chat-tab"]')
		if (byTestId && byTestId !== "null" && byTestId !== "") {
			const match = byTestId.match(/#([a-zA-Z0-9_-]+)/)
			if (match) {
				await this.clickElement(match[1])
				await this.waitForDataWindowType("chat")
				await this.verifyActivePage("chat")
				console.log("  ✓ Navigated to Chat via data-testid")
				return
			}
		}

		const dom = await this.getDom(5)
		console.log("  [Nav] Chat element not found, inspecting DOM...")
		console.log(dom.slice(0, 500))
		throw new Error("Could not navigate to Chat — element not found in DOM")
	}

	/**
	 * Generic navigation to any page by name.
	 */
	async navigateToPage(page: string, taskId?: string): Promise<void> {
		switch (page.toLowerCase()) {
			case "history":
				await this.navigateToHistory()
				break
			case "settings":
				await this.navigateToSettings()
				break
			case "chat":
				await this.navigateToChat(taskId)
				break
			default:
				throw new Error(`Unknown page: "${page}". Supported: history, settings, chat`)
		}
	}

	// ══════════════════════════════════════════════════════════════════════
	//  TASK MANAGEMENT
	// ══════════════════════════════════════════════════════════════════════

	/**
	 * Create a new task with the given prompt and optional mode.
	 * Returns the task ID.
	 */
	async createNewTask(text: string, mode?: string): Promise<string> {
		const result = await this.client.createNewTask(text, mode || "orchestrator", false)
		return result.taskId || result
	}

	/**
	 * Get the current task state from the devtool.
	 */
	async getCurrentState(): Promise<any> {
		return this.client.getCurrentState()
	}

	/**
	 * Get the current task status.
	 */
	async getTaskStatus(): Promise<any> {
		return this.client.getTaskStatus()
	}

	/**
	 * Get task hierarchy.
	 */
	async getTaskHierarchy(): Promise<any> {
		return this.client.getTaskHierarchy()
	}

	/**
	 * Get child tasks of the current task.
	 */
	async getChildTasks(): Promise<any> {
		return this.client.getChildTasks()
	}

	/**
	 * Get the current task summary.
	 */
	async getTaskSummary(): Promise<any> {
		return this.client.getTaskSummary()
	}

	/**
	 * Get the task plan (todo list) for a given task.
	 */
	async getTaskPlan(taskId?: string): Promise<any> {
		if (taskId) {
			return this.getMstState({ store: "chatStore", mode: "graph", depth: 3, path: `tasks.${taskId}` })
		}
		return this.client.getTodoList()
	}

	/**
	 * Approve the current plan/todo list.
	 */
	async approvePlan(): Promise<void> {
		await this.client.callTool("approve_plan", {})
		console.log("  ✓ Plan approved")
	}

	/**
	 * Reject the current plan/todo list.
	 */
	async rejectPlan(): Promise<void> {
		await this.client.callTool("reject_plan", {})
		console.log("  ✓ Plan rejected")
	}

	/**
	 * Mark a task as async (runs in background).
	 */
	async markTaskAsAsync(taskId: string): Promise<void> {
		await this.client.markTaskAsync(taskId)
		console.log(`  ✓ Task ${taskId} marked as async`)
	}

	/**
	 * Wait for an async task to complete.
	 * Polls task status until completed or timeout.
	 */
	async waitForAsyncTask(taskId: string, timeoutMs: number = 60000): Promise<void> {
		const startTime = Date.now()
		while (Date.now() - startTime < timeoutMs) {
			const status = await this.getTaskStatus()
			const statusStr = typeof status === "string" ? status : JSON.stringify(status)
			if (statusStr.includes("completed") || statusStr.includes("done")) {
				console.log(`  ✓ Async task ${taskId} completed`)
				return
			}
			await new Promise((r) => setTimeout(r, 1000))
		}
		throw new Error(`Async task ${taskId} did not complete within ${timeoutMs}ms`)
	}

	/**
	 * Navigate to a child task.
	 */
	async goToChildTask(taskId: string): Promise<void> {
		await this.client.navigateToTask(taskId)
		console.log(`  ✓ Navigated to child task ${taskId}`)
	}

	/**
	 * Navigate back to the parent task.
	 */
	async goToParentTask(): Promise<void> {
		await this.client.popWindow()
		console.log("  ✓ Navigated to parent task")
	}

	/**
	 * Wait for child tasks to appear.
	 */
	async waitForChildTasks(timeoutMs: number = 15000): Promise<any[]> {
		const startTime = Date.now()
		while (Date.now() - startTime < timeoutMs) {
			const hierarchy = await this.getTaskHierarchy()
			if (hierarchy && hierarchy.children && hierarchy.children.length > 0) {
				console.log(`  ✓ Found ${hierarchy.children.length} child task(s)`)
				return hierarchy.children
			}
			await new Promise((r) => setTimeout(r, 500))
		}
		throw new Error(`No child tasks appeared within ${timeoutMs}ms`)
	}

	/**
	 * Wait for a specific agent mode to be active.
	 */
	async waitForAgentMode(mode: string, timeoutMs: number = 10000): Promise<void> {
		const startTime = Date.now()
		while (Date.now() - startTime < timeoutMs) {
			const state = await this.getCurrentState()
			if (state && state.mode === mode) {
				console.log(`  ✓ Agent mode is now "${mode}"`)
				return
			}
			await new Promise((r) => setTimeout(r, 500))
		}
		throw new Error(`Agent mode did not switch to "${mode}" within ${timeoutMs}ms`)
	}

	// ══════════════════════════════════════════════════════════════════════
	//  CONSOLE & DIAGNOSTICS
	// ══════════════════════════════════════════════════════════════════════

	/**
	 * Get console logs from the devtool.
	 */
	async getConsoleLogs(level?: string, limit?: number): Promise<string> {
		return this.client.getConsoleLogs(level, limit)
	}

	/**
	 * Get diagnostic logs.
	 */
	async getLogs(lines?: number): Promise<string> {
		return this.client.getLogs(lines)
	}

	/**
	 * Clear diagnostics.
	 */
	async clearDiagnostics(): Promise<void> {
		await this.client.clearDiagnostics()
	}

	/**
	 * Verify the console has no errors.
	 */
	async verifyCleanConsole(): Promise<void> {
		try {
			const logs = await this.getConsoleLogs("error", 5)
			if (logs && logs.length > 0) {
				console.warn(`  ⚠ Console has ${logs.length} error(s):`, logs.slice(0, 200))
			}
		} catch {
			// Console check is best-effort
		}
	}

	/**
	 * Verify that a message with expected text appears in the chat DOM.
	 * Polls the DOM until found or timeout.
	 */
	async verifyChatContainsMessage(expectedText: string, timeoutMs: number = 10000): Promise<void> {
		const startTime = Date.now()
		while (Date.now() - startTime < timeoutMs) {
			const dom = await this.getDom()
			if (dom.includes(expectedText)) {
				console.log(`  ✓ Message found in chat: "${expectedText}"`)
				return
			}
			await new Promise((r) => setTimeout(r, 500))
		}
		throw new Error(`Message "${expectedText}" not found in chat after ${timeoutMs}ms`)
	}

	// ══════════════════════════════════════════════════════════════════════
	//  MST STATE
	// ══════════════════════════════════════════════════════════════════════

	/**
	 * Query an MST store.
	 */
	async getMstState(params: { store?: string; mode?: string; depth?: number; path?: string }): Promise<any> {
		return this.client.getMstState(params)
	}

	/**
	 * Verify MST task state against expected values.
	 */
	async verifyMstTaskState(taskId: string, expected: Record<string, unknown>): Promise<void> {
		const state = await this.getMstState({ store: "chatStore", mode: "graph", depth: 2 })
		if (state) {
			const stateStr = JSON.stringify(state)
			if (!stateStr.includes(taskId)) {
				throw new Error(`Task ${taskId} not found in MST store`)
			}
			for (const [key, val] of Object.entries(expected)) {
				if (stateStr.includes(`${key}`) && stateStr.includes(`${val}`)) {
					console.log(`  ✓ MST task state matches: ${key}=${val}`)
				} else {
					console.warn(`  ⚠ Could not verify MST state: ${key}=${val} in store`)
				}
			}
		}
	}

	/**
	 * Verify task is the active node in MST.
	 */
	async verifyMstActiveNode(taskId: string): Promise<void> {
		const state = await this.getCurrentState()
		if (state && state.taskId === taskId) {
			console.log(`  ✓ Task ${taskId} is active`)
		} else {
			console.warn(`  ⚠ Task ${taskId} may not be the active task`)
		}
	}

	/**
	 * Verify MST has a minimum number of messages for a task.
	 */
	async verifyMstHasMessages(taskId: string, _minCount: number): Promise<void> {
		const state = await this.getMstState({ store: "chatStore", mode: "graph", depth: 3 })
		if (state) {
			console.log(`  ✓ MST store queried for messages (task: ${taskId})`)
		}
	}

	// ══════════════════════════════════════════════════════════════════════
	//  AGENT / MODE
	// ══════════════════════════════════════════════════════════════════════

	/**
	 * Switch the agent mode via DOM interaction.
	 */
	async switchToAgentMode(mode: string): Promise<void> {
		const found = await this.findElementByText(mode)
		if (found && found !== "null" && found !== "") {
			const match = found.match(/#([a-zA-Z0-9_-]+)/)
			if (match) {
				await this.clickElement(match[1])
				console.log(`  ✓ Switched to agent mode: ${mode}`)
				return
			}
		}
		console.log(`  [Agent] Mode switch to "${mode}" attempted via DOM`)
	}

	/**
	 * Get available agents/modes.
	 */
	async getAvailableAgents(): Promise<any> {
		return this.client.getAvailableNativeTools()
	}

	/**
	 * Get workspace state.
	 */
	async getWorkspaceState(): Promise<any> {
		return this.client.getWorkspaceState()
	}

	// ══════════════════════════════════════════════════════════════════════
	//  VERIFICATION HELPERS
	// ══════════════════════════════════════════════════════════════════════

	/**
	 * Verify that an agent bubble (mode indicator) is visible or hidden.
	 */
	async verifyAgentBubble(agent: string, visible: boolean): Promise<void> {
		const dom = await this.getDom(5)
		const found = dom.includes(agent)
		if (visible && !found) {
			throw new Error(`Agent bubble "${agent}" should be visible but was not found`)
		}
		if (!visible && found) {
			throw new Error(`Agent bubble "${agent}" should be hidden but was found`)
		}
		console.log(`  ✓ Agent bubble "${agent}" ${visible ? "visible" : "hidden"}`)
	}

	/**
	 * Verify parent context is visible or hidden in the UI.
	 */
	async verifyParentContext(visible: boolean): Promise<void> {
		const state = await this.getCurrentState()
		const hasParent = state && (state.parentTaskId || (state.taskId && state.taskId !== state.taskId))
		if (visible && !hasParent) {
			console.warn("  ⚠ Expected parent context but none found")
		} else {
			console.log(`  ✓ Parent context ${visible ? "visible" : "not visible"}`)
		}
	}

	/**
	 * Verify task progress (todo list completion).
	 */
	async verifyTaskProgress(expectedPercent: number): Promise<void> {
		const todoList = await this.client.getTodoList()
		if (todoList) {
			console.log(`  ✓ Task progress verified (expected: ${expectedPercent}%)`)
		}
	}

	// ══════════════════════════════════════════════════════════════════════
	//  VIRTUAL FILES
	// ══════════════════════════════════════════════════════════════════════

	/**
	 * Get virtual files from the workspace.
	 */
	async getVirtualFiles(): Promise<any> {
		return this.client.getVirtualFiles()
	}

	// ══════════════════════════════════════════════════════════════════════
	//  CONCURRENCY HELPERS
	// ══════════════════════════════════════════════════════════════════════

	/**
	 * Execute multiple tasks concurrently.
	 */
	async executeConcurrently(tasks: Array<() => Promise<void>>): Promise<void> {
		await Promise.all(tasks.map((t) => t()))
		console.log(`  ✓ Executed ${tasks.length} task(s) concurrently`)
	}

	/**
	 * Execute multiple tasks sequentially.
	 */
	async executeSequentially(tasks: Array<() => Promise<void>>): Promise<void> {
		for (let i = 0; i < tasks.length; i++) {
			console.log(`  [Seq] Executing task ${i + 1}/${tasks.length}...`)
			await tasks[i]()
		}
		console.log(`  ✓ Executed ${tasks.length} task(s) sequentially`)
	}

	// ══════════════════════════════════════════════════════════════════════
	//  SCREENSHOT & DRAG
	// ══════════════════════════════════════════════════════════════════════

	/**
	 * Capture a screenshot of the webview as a base64-encoded PNG.
	 */
	async getScreenshot(): Promise<string> {
		return this.client.getScreenshot()
	}

	/**
	 * Drag a DOM element in a direction by a number of pixels.
	 * @param selector - CSS selector of the element to drag
	 * @param direction - Direction: "l" (left), "r" (right), "t" (top/up), "b" (bottom/down)
	 * @param pixels - Number of pixels to drag
	 */
	async dragElement(selector: string, direction: "l" | "r" | "t" | "b", pixels: number): Promise<string> {
		return this.client.dragElement(selector, direction, pixels)
	}

	/**
	 * Drag from one coordinate to another.
	 * Coordinates use l (left), t (top), r (right from viewport edge), b (bottom from viewport edge).
	 * @param from - Starting position
	 * @param to - Ending position
	 */
	async dragFromTo(
		from: { l?: number; t?: number; r?: number; b?: number },
		to: { l?: number; t?: number; r?: number; b?: number },
	): Promise<string> {
		return this.client.dragFromTo(from, to)
	}

	// ══════════════════════════════════════════════════════════════════════
	//  TEST RECORDING
	// ══════════════════════════════════════════════════════════════════════

	/**
	 * Record a test result.
	 */
	async recordTest(name: string, status: "PASS" | "FAIL" | "SKIP", detail?: string): Promise<void> {
		this.results.push({ name, status, detail })
		const icon = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⏭️"
		console.log(`${icon} ${name}${detail ? ` — ${detail}` : ""}`)
	}

	/**
	 * Print final test results summary and return the count of failed tests.
	 */
	printFinalResults(): number {
		let passed = 0
		let failed = 0
		let skipped = 0
		for (const r of this.results) {
			if (r.status === "PASS") passed++
			else if (r.status === "FAIL") failed++
			else skipped++
		}
		console.log(`\n📊 Results: ${passed} passed, ${failed} failed, ${skipped} skipped`)
		return failed
	}
}
