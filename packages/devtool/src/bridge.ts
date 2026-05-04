/**
 * ExtensionBridge defines the contract between the Devtool package and the
 * extension that hosts it. The extension provides a concrete implementation
 * of this interface, giving the Devtool access to the extension's capabilities
 * without importing extension-internal modules directly.
 *
 * This is the key abstraction that makes @jabberwock/devtool a standalone
 * package — it doesn't depend on ClineProvider or any other extension-internal
 * type. The extension implements this bridge and passes it to the Devtool.
 *
 * The bridge exposes only generic, platform-agnostic operations:
 * - DOM interaction (find/click/scroll/type/select — Playwright-style)
 * - Console log retrieval
 * - Diagnostics (logs, snapshot, clear)
 * - State inspection (MST, extension info, current state)
 * - Settings
 */
export interface ExtensionBridge {
	getDom(maxDepth?: number, maxChildren?: number): Promise<string>
	findElement(selector: string): Promise<string>
	clickElement(id: string): Promise<string>
	scrollElement(id: string, direction: string): Promise<string>
	typeText(id: string, text: string): Promise<string>
	selectOption(id: string, value: string): Promise<string>

	/**
	 * Execute a VS Code command in the extension host (not in the webview).
	 * Uses vscode.commands.executeCommand() under the hood.
	 */
	executeVscodeCommand(command: string, args?: unknown): Promise<string>
	runCommand(command: string): Promise<string>
	getConsoleLogs(level?: string, limit?: number, offset?: number): Promise<string>
	getLogs(lines?: number): Promise<string>
	getDiagnosticsSnapshot(params?: {
		limit?: number
		offset?: number
		level?: string
		search?: string
		includeLogs?: boolean
		includeMetrics?: boolean
		includePatches?: boolean
		includeTraces?: boolean
		includeResources?: boolean
	}): Promise<string>
	clearDiagnostics(): Promise<string>
	getMstState(params?: {
		store?: string
		mode?: string
		depth?: number
		path?: string
		nodeId?: string
		fields?: string
	}): Promise<string>
	getExtensionInfo(): Promise<string>
	getCurrentState(): Promise<string>
	getScreenshot(): Promise<string>
	getActivePage(): Promise<string>
	dragElement(selector: string, direction: string, pixels: number): Promise<string>
	dragFromTo(
		from: { l?: number; t?: number; r?: number; b?: number },
		to: { l?: number; t?: number; r?: number; b?: number },
	): Promise<string>
}
