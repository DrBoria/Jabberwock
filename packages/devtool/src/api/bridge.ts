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

	/**
	 * Get console logs from the specified environment.
	 *
	 * @param params.env - "backend" (extension host) or "frontend" (webview)
	 * @param params.level - Optional filter: "error" | "warn" | "info" | "debug" (defaults to all)
	 * @param params.limit - Max entries to return (default: 10)
	 * @param params.cursor - Number of entries to skip from the end (default: 0)
	 * @returns JSON string with { lines: string[], totalLines: number }
	 */
	getConsole(params: {
		env: "backend" | "frontend"
		level?: string
		limit?: number
		cursor?: number
	}): Promise<string>

	/**
	 * Search console logs by text content across environments.
	 *
	 * @param params.env - Optional filter: "backend" | "frontend" (defaults to both)
	 * @param params.query - Text to search for (case-insensitive substring match)
	 * @param params.level - Optional level filter
	 * @param params.limit - Max entries to return (default: 10)
	 * @param params.cursor - Number of entries to skip from the end (default: 0)
	 * @returns JSON string with { lines: string[], totalLines: number }
	 */
	searchConsole(params: {
		env?: "backend" | "frontend"
		query: string
		level?: string
		limit?: number
		cursor?: number
	}): Promise<string>

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

	/** Get paginated snapshot of a store. Use env: "backend" | "frontend" to select environment. */
	getStoreState(params: {
		env?: "backend" | "frontend"
		store?: string
		limit?: number
		cursor?: number
	}): Promise<string>

	/** Get paginated available actions on a store */
	getStoreActions(params: { env: "backend" | "frontend"; limit?: number; cursor?: number }): Promise<string>

	/** Search store state by content, ID, or partial text match */
	searchState(params: {
		env: "backend" | "frontend"
		query: string
		store?: string
		limit?: number
		cursor?: number
	}): Promise<string>

	/** Filter actions by name pattern */
	filterActions(params: {
		env: "backend" | "frontend"
		pattern: string
		limit?: number
		cursor?: number
	}): Promise<string>

	/** Search for specific actions */
	searchActions(params: {
		env: "backend" | "frontend"
		query: string
		limit?: number
		cursor?: number
	}): Promise<string>

	/** Count available actions on a store */
	countActions(params: { env: "backend" | "frontend" }): Promise<string>

	/** Apply a previous snapshot (undo) */
	applyPreviousState(params: { env: "backend" | "frontend" }): Promise<string>

	/** Apply a next snapshot (redo) */
	applyNextState(params: { env: "backend" | "frontend" }): Promise<string>

	/** Get action log from onAction buffer */
	getStoreActionsLog(params: { env: "backend" | "frontend"; before?: number; after?: number }): Promise<string>

	// ── Message Interception & Event Bus ──────────────────────────

	/** Send a message to the webview */
	sendMessage(type: string, action: string, payload?: unknown): Promise<void>
	/** Set a message interceptor to mock responses */
	setMessageInterceptor(
		direction: "send" | "receive",
		type: string,
		action: string | undefined,
		response: unknown,
	): Promise<void>
	/** Clear all message interceptors */
	clearInterceptors(): Promise<void>
	/** Get active message interceptors */
	getActiveInterceptors(): Promise<string>
	/** Clear the message trace log */
	clearMessageTrace(): Promise<void>
	/** Get available modes */
	getModes(): Promise<string>
	/** Get current mode */
	getMode(): Promise<string>
}
