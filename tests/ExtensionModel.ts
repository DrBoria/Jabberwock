/**
 * ExtensionModel — Page Model for Jabberwock E2E testing.
 *
 * Architecture (like Playwright):
 *   @jabberwock/devtool  = Playwright (transport, connection, primitives)
 *   ExtensionModel       = Page (declarative methods composing primitives)
 *   models/*             = Sub-page models (navigation, chat, state, etc.)
 *
 * ExtensionModel is a thin orchestrator: it creates and delegates to
 * domain-specific models, exposing their methods at the top level for
 * backward compatibility with tests.
 *
 * All methods are implemented via DOM operations (findElement, clickElement,
 * browser console JS) — NO interceptor usage.
 *
 * Usage:
 *   const client = new DevtoolClient()
 *   await client.connect()
 *   const app = new ExtensionModel(client)
 *   await app.commands.historyButtonClicked()
 *   await app.verifyActivePage("history")
 *   await client.disconnect()
 */

import type { DevtoolClient } from "../packages/devtool/src/client"
import { DomModel } from "./models/domModel"
import { NavigationModel } from "./models/navigationModel"
import { ChatModel } from "./models/chatModel"
import { StateModel } from "./models/stateModel"
import { DiagnosticsModel } from "./models/diagnosticsModel"
import { CommandModel } from "./models/commandModel"
import type { ExtensionCommand } from "../packages/devtool/src/command-registry"

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
 * It composes domain-specific models and exposes their methods at the
 * top level for test convenience.
 *
 * Sub-models are also accessible directly via properties:
 *   app.nav.navigateToHistory()
 *   app.chat.createNewTask("prompt")
 *   app.state.getTaskStatus()
 *   app.diag.verifyCleanConsole()
 *   app.cmd.executeCommand("historyButtonClicked")
 */
export class ExtensionModel {
	private results: TestResult[] = []

	// ── Sub-models ───────────────────────────────────────────────────────

	/** Core DOM primitives (getDom, findElement, clickElement, etc.) */
	public readonly dom: DomModel
	/** Page navigation (navigateTo*, verifyActivePage, etc.) */
	public readonly nav: NavigationModel
	/** Chat interactions (createNewTask, switchToAgentMode, etc.) */
	public readonly chat: ChatModel
	/** MST state queries (getMstState, getTaskStatus, etc.) */
	public readonly state: StateModel
	/** Console & diagnostics (verifyCleanConsole, verifyNoNewApiRequests) */
	public readonly diag: DiagnosticsModel
	/** VS Code command discovery & execution */
	public readonly cmd: CommandModel

	/**
	 * Dynamic command runner — automatically populated from package.json.
	 *
	 * Allows calling any VS Code command by its short name:
	 *   await app.commands.historyButtonClicked()
	 *   await app.commands.settingsButtonClicked()
	 *   await app.commands.plusButtonClicked()
	 */
	public readonly commands: Record<string, (...args: unknown[]) => Promise<void>>

	/**
	 * @param client The DevtoolClient instance (transport + primitives layer)
	 * @param packageJsonPath Optional path to the extension's package.json
	 */
	constructor(
		public readonly client: DevtoolClient,
		packageJsonPath?: string,
	) {
		// Create sub-models with shared DomModel
		this.dom = new DomModel(client)
		this.nav = new NavigationModel(client, this.dom)
		this.chat = new ChatModel(client, this.dom, this.nav)
		this.state = new StateModel(client)
		this.diag = new DiagnosticsModel(client)
		this.cmd = new CommandModel(client, this.dom, packageJsonPath)

		// Expose the dynamic commands Proxy from CommandModel
		this.commands = this.cmd.commands
	}

	// ══════════════════════════════════════════════════════════════════════
	//  COMMAND DISCOVERY & EXECUTION
	// ══════════════════════════════════════════════════════════════════════

	/**
	 * Get all available command names discovered from package.json.
	 */
	getCommandNames(): string[] {
		return this.cmd.getCommandNames()
	}

	/**
	 * Get all available command descriptors (ID, name, title).
	 */
	getAvailableCommands(): ExtensionCommand[] {
		return this.cmd.getAvailableCommands()
	}

	/**
	 * Execute a VS Code command by its short name or full ID.
	 */
	async executeCommand(idOrName: string, ...args: unknown[]): Promise<void> {
		await this.cmd.executeCommand(idOrName, ...args)
	}

	// ══════════════════════════════════════════════════════════════════════
	//  CORE DOM PRIMITIVES
	// ══════════════════════════════════════════════════════════════════════

	async getDom(maxDepth?: number, maxChildren?: number): Promise<string> {
		return this.dom.getDom(maxDepth, maxChildren)
	}

	async findElementByText(text: string): Promise<string> {
		return this.dom.findElementByText(text)
	}

	async findElementBySelector(selector: string): Promise<string> {
		return this.dom.findElementBySelector(selector)
	}

	async findElementById(id: string): Promise<string> {
		return this.dom.findElementById(id)
	}

	async clickElement(id: string): Promise<string> {
		return this.dom.clickElement(id)
	}

	async typeText(id: string, text: string): Promise<string> {
		return this.dom.typeText(id, text)
	}

	// ══════════════════════════════════════════════════════════════════════
	//  PAGE VERIFICATION & NAVIGATION
	// ══════════════════════════════════════════════════════════════════════

	async getActivePage(): Promise<string> {
		return this.nav.getActivePage()
	}

	async verifyActivePage(expected: string): Promise<void> {
		await this.nav.verifyActivePage(expected)
	}

	async getUiWindowStack(): Promise<string[]> {
		return this.nav.getUiWindowStack()
	}

	async verifyNoExtraWindows(expectedWindowType: string): Promise<void> {
		await this.nav.verifyNoExtraWindows(expectedWindowType)
	}

	async waitForDataWindowType(expected: string, timeoutMs: number = 5000): Promise<void> {
		await this.nav.waitForDataWindowType(expected, timeoutMs)
	}

	async navigateToHistory(): Promise<void> {
		await this.nav.navigateToHistory()
	}

	async navigateToSettings(): Promise<void> {
		await this.nav.navigateToSettings()
	}

	async navigateToChat(taskId?: string): Promise<void> {
		await this.nav.navigateToChat(taskId)
	}

	async navigateToPage(page: string, taskId?: string): Promise<void> {
		await this.nav.navigateToPage(page, taskId)
	}

	// ══════════════════════════════════════════════════════════════════════
	//  CHAT / TASK CREATION
	// ══════════════════════════════════════════════════════════════════════

	async createNewTask(text: string, mode?: string): Promise<string> {
		return this.chat.createNewTask(text, mode)
	}

	async verifyChatContainsMessage(expectedText: string, timeoutMs: number = 10000): Promise<void> {
		await this.chat.verifyChatContainsMessage(expectedText, timeoutMs)
	}

	async switchToAgentMode(mode: string): Promise<void> {
		await this.chat.switchToAgentMode(mode)
	}

	async getAvailableAgents(): Promise<Array<{ name: string; slug?: string }>> {
		return this.chat.getAvailableAgents()
	}

	// ══════════════════════════════════════════════════════════════════════
	//  MST STATE
	// ══════════════════════════════════════════════════════════════════════

	async getMstState(params: { store?: string; mode?: string; depth?: number; path?: string }): Promise<any> {
		return this.state.getMstState(params)
	}

	async getCurrentState(): Promise<any> {
		return this.state.getCurrentState()
	}

	async getTaskStatus(): Promise<any> {
		return this.state.getTaskStatus()
	}

	async getTaskHierarchy(): Promise<any> {
		return this.state.getTaskHierarchy()
	}

	async getTaskStack(): Promise<Array<{ taskId: string; mode: string; title?: string }>> {
		return this.state.getTaskStack()
	}

	async getWorkspaceState(): Promise<any> {
		return this.state.getWorkspaceState()
	}

	async verifyMstTaskState(taskId: string, expected: Record<string, unknown>): Promise<void> {
		await this.state.verifyMstTaskState(taskId, expected)
	}

	async verifyMstActiveNode(taskId: string): Promise<void> {
		await this.state.verifyMstActiveNode(taskId)
	}

	// ══════════════════════════════════════════════════════════════════════
	//  CONSOLE & DIAGNOSTICS
	// ══════════════════════════════════════════════════════════════════════

	async getConsoleLogs(level?: string, limit?: number): Promise<string> {
		return this.diag.getConsoleLogs(level, limit)
	}

	async verifyCleanConsole(): Promise<void> {
		await this.diag.verifyCleanConsole()
	}

	async verifyNoNewApiRequests(waitMs: number = 30000): Promise<void> {
		await this.diag.verifyNoNewApiRequests(waitMs)
	}

	// ══════════════════════════════════════════════════════════════════════
	//  TEST RESULT TRACKING
	// ══════════════════════════════════════════════════════════════════════

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
