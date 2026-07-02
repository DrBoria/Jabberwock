export type CallToolFn = (name: string, args: Record<string, unknown>) => Promise<unknown>

export interface ClientConvenienceMethods {
	runCommand(command: string): Promise<string>
	executeVscodeCommand(command: string, args?: unknown): Promise<string>
	findElement(selector: string, depth?: number, maxChildren?: number, command?: string): Promise<string>
	clickElement(id?: string, selector?: string): Promise<string>
	typeText(id?: string, selector?: string, text?: string, submit?: boolean): Promise<string>
	scrollElement(id: string, direction: "up" | "down" | "left" | "right"): Promise<string>
	selectOption(id: string, value: string): Promise<string>
	getConsole(env: "backend" | "frontend", level?: string, limit?: number, cursor?: number): Promise<string>
	searchConsole(query: string, env?: string, level?: string, limit?: number, cursor?: number): Promise<string>
	getLogs(lines?: number): Promise<string>
	getDiagnosticsSnapshot(params?: Record<string, unknown>): Promise<string>
	clearDiagnostics(): Promise<string>
	getStoreState(params: Record<string, unknown>): Promise<unknown>
	searchState(params: Record<string, unknown>): Promise<unknown>
	getExtensionInfo(): Promise<unknown>
	getCurrentState(): Promise<unknown>
	getScreenshot(): Promise<string>
	dragElement(selector: string, direction: "l" | "r" | "t" | "b", pixels: number): Promise<string>
	dragFromTo(
		from: { l?: number; t?: number; r?: number; b?: number },
		to: { l?: number; t?: number; r?: number; b?: number },
	): Promise<string>
	sendMessageToWebview(type: string, action: string, payload?: unknown): Promise<unknown>
	setMessageInterceptor(
		direction: string,
		type: string,
		action: string | undefined,
		response: unknown,
	): Promise<unknown>
	removeMessageInterceptor(direction: string, type: string, action?: string): Promise<unknown>
	getActiveInterceptors(): Promise<unknown>
	getMessageTrace(direction?: string, type?: string, action?: string): Promise<unknown>
	clearMessageTrace(): Promise<unknown>
}

export function createClientMethods(callTool: CallToolFn): ClientConvenienceMethods {
	return {
		async runCommand(command: string): Promise<string> {
			return callTool("run_command", { command }) as Promise<string>
		},

		async executeVscodeCommand(command: string, args?: unknown): Promise<string> {
			return callTool("execute_vscode_command", { command, args }) as Promise<string>
		},

		async findElement(selector: string, depth?: number, maxChildren?: number, command?: string): Promise<string> {
			return callTool("find_element", { selector, depth, maxChildren, command }) as Promise<string>
		},

		async clickElement(id?: string, selector?: string): Promise<string> {
			return callTool("click_element", { id, selector }) as Promise<string>
		},

		async typeText(id?: string, selector?: string, text?: string, submit?: boolean): Promise<string> {
			return callTool("type_text", { id, selector, text, submit }) as Promise<string>
		},

		async scrollElement(id: string, direction: "up" | "down" | "left" | "right"): Promise<string> {
			return callTool("scroll_element", { id, direction }) as Promise<string>
		},

		async selectOption(id: string, value: string): Promise<string> {
			return callTool("select_option", { id, value }) as Promise<string>
		},

		async getConsole(
			env: "backend" | "frontend",
			level?: string,
			limit?: number,
			cursor?: number,
		): Promise<string> {
			return callTool("get_console", { env, level, limit, cursor }) as Promise<string>
		},

		async searchConsole(
			query: string,
			env?: string,
			level?: string,
			limit?: number,
			cursor?: number,
		): Promise<string> {
			return callTool("search_console", { query, env, level, limit, cursor }) as Promise<string>
		},

		async getLogs(lines?: number): Promise<string> {
			return callTool("get_logs", { lines }) as Promise<string>
		},

		async getDiagnosticsSnapshot(params?: Record<string, unknown>): Promise<string> {
			return callTool("get_diagnostics_snapshot", params ?? {}) as Promise<string>
		},

		async clearDiagnostics(): Promise<string> {
			return callTool("clear_diagnostics", {}) as Promise<string>
		},

		async getStoreState(params: Record<string, unknown>): Promise<unknown> {
			return callTool("get_store_state", params)
		},

		async searchState(params: Record<string, unknown>): Promise<unknown> {
			return callTool("search_state", params)
		},

		async getExtensionInfo(): Promise<unknown> {
			return callTool("get_extension_info", {})
		},

		async getCurrentState(): Promise<unknown> {
			return callTool("get_current_state", {})
		},

		async getScreenshot(): Promise<string> {
			return callTool("get_screenshot", {}) as Promise<string>
		},

		async dragElement(selector: string, direction: "l" | "r" | "t" | "b", pixels: number): Promise<string> {
			return callTool("drag_element", { selector, direction, pixels }) as Promise<string>
		},

		async dragFromTo(
			from: { l?: number; t?: number; r?: number; b?: number },
			to: { l?: number; t?: number; r?: number; b?: number },
		): Promise<string> {
			return callTool("drag_from_to", { from, to }) as Promise<string>
		},

		async sendMessageToWebview(type: string, action: string, payload?: unknown): Promise<unknown> {
			return callTool("send_message_to_webview", { type, action, ...(payload ? { payload } : {}) })
		},

		async setMessageInterceptor(
			direction: string,
			type: string,
			action: string | undefined,
			response: unknown,
		): Promise<unknown> {
			return callTool("set_message_interceptor", { direction, type, action, response })
		},

		async removeMessageInterceptor(direction: string, type: string, action?: string): Promise<unknown> {
			return callTool("remove_message_interceptor", { direction, type, action })
		},

		async getActiveInterceptors(): Promise<unknown> {
			return callTool("get_active_interceptors", {})
		},

		async getMessageTrace(direction?: string, type?: string, action?: string): Promise<unknown> {
			return callTool("get_message_trace", { direction, type, action })
		},

		async clearMessageTrace(): Promise<unknown> {
			return callTool("clear_message_trace", {})
		},
	}
}
