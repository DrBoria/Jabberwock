/**
 * MessageInterceptor — generic message interception and tracing for integration testing.
 *
 * Lives in @jabberwock/devtool (packages/devtool) as a standalone class.
 * ClineProvider imports it and calls onBeforeSend/onBeforeReceive as hooks.
 *
 * Usage:
 *   const interceptor = new MessageInterceptor()
 *   interceptor.set({ direction: "webview→backend", type: "action", action: "chatButtonClicked", response: { result: "mocked" } })
 *
 *   // In postMessageToWebview:
 *   const result = interceptor.onBeforeSend(message)
 *   if (result.intercepted) return result.response
 *
 *   // In setWebviewMessageListener:
 *   const result = interceptor.onBeforeReceive(message)
 *   if (result.intercepted) return result.response
 */

export interface InterceptorConfig {
	/** Direction: "backend→webview" (send) or "webview→backend" (receive) */
	direction: string
	/** Message type (e.g. "action", "command") */
	type: string
	/** Optional action/command name (e.g. "chatButtonClicked") */
	action?: string
	/** Mock response to return when intercepted */
	response: unknown
}

export interface TraceEntry {
	direction: string
	message: unknown
	intercepted: boolean
	mockResponse?: unknown
	timestamp: string
}

export interface TraceFilter {
	direction?: string
	type?: string
	action?: string
}

export class MessageInterceptor {
	private interceptors = new Map<string, InterceptorConfig>()
	private trace: TraceEntry[] = []
	private maxTraceSize = 1000

	/**
	 * Register an interceptor.
	 * Key is computed as `${direction}:${type}:${action || "*"}`.
	 */
	set(config: InterceptorConfig): void {
		const key = this.makeKey(config.direction, config.type, config.action)
		this.interceptors.set(key, config)
	}

	/**
	 * Remove an interceptor.
	 */
	remove(direction: string, type: string, action?: string): boolean {
		const key = this.makeKey(direction, type, action)
		return this.interceptors.delete(key)
	}

	/**
	 * Remove all interceptors matching direction + type (optionally action).
	 */
	removeMany(direction: string, type: string, action?: string): number {
		const prefix = this.makeKey(direction, type, action)
		let count = 0
		for (const key of this.interceptors.keys()) {
			if (key.startsWith(prefix)) {
				this.interceptors.delete(key)
				count++
			}
		}
		return count
	}

	/**
	 * Get all active interceptors.
	 */
	getAll(): InterceptorConfig[] {
		return Array.from(this.interceptors.values())
	}

	/**
	 * Clear all interceptors.
	 */
	clearAll(): void {
		this.interceptors.clear()
	}

	/**
	 * Hook: check if a message being SENT (backend→webview) should be intercepted.
	 * Returns { intercepted: true, response } if matched, or { intercepted: false }.
	 */
	onBeforeSend(message: { type?: string; action?: string }): { intercepted: boolean; response?: unknown } {
		return this.check("backend→webview", message)
	}

	/**
	 * Hook: check if a message being RECEIVED (webview→backend) should be intercepted.
	 * Returns { intercepted: true, response } if matched, or { intercepted: false }.
	 */
	onBeforeReceive(message: { type?: string; action?: string }): { intercepted: boolean; response?: unknown } {
		return this.check("webview→backend", message)
	}

	/**
	 * Send a message through the interceptor (for send_message_to_webview tool).
	 * Logs the message and checks interceptors.
	 */
	sendMessage(message: { type?: string; action?: string }): { intercepted: boolean; response?: unknown } {
		const result = this.onBeforeSend(message)
		this.trace.push({
			direction: "backend→webview",
			message,
			intercepted: result.intercepted,
			mockResponse: result.response as unknown,
			timestamp: new Date().toISOString(),
		})
		this.trimTrace()
		return result
	}

	/**
	 * Receive a message through the interceptor (for logging incoming messages).
	 */
	receiveMessage(message: { type?: string; action?: string }): { intercepted: boolean; response?: unknown } {
		const result = this.onBeforeReceive(message)
		this.trace.push({
			direction: "webview→backend",
			message,
			intercepted: result.intercepted,
			mockResponse: result.response as unknown,
			timestamp: new Date().toISOString(),
		})
		this.trimTrace()
		return result
	}

	/**
	 * Get message trace, optionally filtered.
	 */
	getTrace(filter?: TraceFilter, limit?: number): { entries: TraceEntry[]; totalCount: number } {
		let entries = this.trace
		if (filter) {
			if (filter.direction) {
				entries = entries.filter((e) => e.direction === filter.direction)
			}
			if (filter.type) {
				entries = entries.filter((e) => {
					const msg = e.message as { type?: string }
					return msg.type === filter.type
				})
			}
			if (filter.action) {
				entries = entries.filter((e) => {
					const msg = e.message as { action?: string }
					return msg.action === filter.action
				})
			}
		}
		const totalCount = entries.length
		if (limit !== undefined && limit >= 0) {
			entries = entries.slice(-limit)
		}
		return { entries, totalCount }
	}

	/**
	 * Clear the message trace.
	 */
	clearTrace(): void {
		this.trace = []
	}

	// ── Private ──────────────────────────────────────────────────────────

	private makeKey(direction: string, type: string, action?: string): string {
		return `${direction}:${type}:${action || "*"}`
	}

	private check(
		direction: string,
		message: { type?: string; action?: string },
	): { intercepted: boolean; response?: unknown } {
		// Try exact match first: direction:type:action
		if (message.type) {
			const exactKey = this.makeKey(direction, message.type, message.action)
			const exact = this.interceptors.get(exactKey)
			if (exact) {
				return { intercepted: true, response: exact.response }
			}

			// Try wildcard action: direction:type:*
			const wildcardKey = this.makeKey(direction, message.type)
			const wildcard = this.interceptors.get(wildcardKey)
			if (wildcard) {
				return { intercepted: true, response: wildcard.response }
			}
		}

		return { intercepted: false }
	}

	private trimTrace(): void {
		if (this.trace.length > this.maxTraceSize) {
			this.trace = this.trace.slice(-this.maxTraceSize)
		}
	}
}
