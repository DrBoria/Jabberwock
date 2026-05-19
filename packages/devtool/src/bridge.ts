/**
 * ExtensionBridge defines the contract between the Devtool package and the
 * extension that hosts it. The extension provides a concrete implementation
 * of this interface, giving the Devtool access to the extension's capabilities
 * without importing extension-internal modules directly.
 *
 * This is the key abstraction that makes @jabberwock/devtool a standalone
 * package — it doesn't depend on EventBridge or any other extension-internal
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
	findElement(selector: string, depth?: number, maxChildren?: number, command?: string): Promise<string>
	clickElement(id?: string, selector?: string): Promise<string>
	scrollElement(id?: string, direction?: string, selector?: string): Promise<string>
	typeText(id?: string, selector?: string, text?: string, submit?: boolean): Promise<string>
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

	// ── Store State (backend + frontend) ────────────────────────

	/** Get paginated snapshot of a store */
	getStoreState(params: {
		store: "backend" | "frontend"
		path?: string
		limit?: number
		cursor?: number
	}): Promise<string>

	/** Get paginated available actions on a store */
	getStoreActions(params: { store: "backend" | "frontend"; limit?: number; cursor?: number }): Promise<string>

	/** Filter state by dot-separated path */
	filterState(params: {
		store: "backend" | "frontend"
		path: string
		limit?: number
		cursor?: number
	}): Promise<string>

	/** Filter actions by name pattern */
	filterActions(params: {
		store: "backend" | "frontend"
		pattern: string
		limit?: number
		cursor?: number
	}): Promise<string>

	/** Search for specific actions */
	searchActions(params: {
		store: "backend" | "frontend"
		query: string
		limit?: number
		cursor?: number
	}): Promise<string>

	/** Count available actions on a store */
	countActions(params: { store: "backend" | "frontend" }): Promise<string>

	/** Apply a previous snapshot (undo) */
	applyPreviousState(params: { store: "backend" | "frontend" }): Promise<string>

	/** Apply a next snapshot (redo) */
	applyNextState(params: { store: "backend" | "frontend" }): Promise<string>

	/** Get action log from onAction buffer */
	getStoreActionsLog(params: { store: "backend" | "frontend"; before?: number; after?: number }): Promise<string>
}
