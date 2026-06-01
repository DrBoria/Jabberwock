import type { ExtensionBridge } from "../bridge.js"

export interface InterceptorConfig {
	direction: "send" | "receive"
	type: string
	action?: string
	response?: Record<string, unknown>
}

export interface TraceEntry {
	timestamp: number
	direction: string
	type: string
	action?: string
	payload?: string
	intercepted: boolean
}

export interface TraceFilter {
	direction?: string
	type?: string
	action?: string
}

export class MessageInterceptor {
	private interceptors: InterceptorConfig[] = []
	private trace: TraceEntry[] = []
	private maxTraceSize = 1000
	private bridge: ExtensionBridge

	constructor(bridge: ExtensionBridge) {
		this.bridge = bridge
	}

	set(config: InterceptorConfig): void {
		this.interceptors.push(config)
	}

	remove(direction: string, type: string, action?: string): boolean {
		const index = this.interceptors.findIndex(
			(i) => i.direction === direction && i.type === type && i.action === action,
		)
		if (index !== -1) {
			this.interceptors.splice(index, 1)
			return true
		}
		return false
	}

	removeMany(direction: string, type: string, action?: string): number {
		const before = this.interceptors.length
		this.interceptors = this.interceptors.filter(
			(i) => !(i.direction === direction && i.type === type && (!action || i.action === action)),
		)
		return before - this.interceptors.length
	}

	clear(): void {
		this.interceptors = []
	}

	getActive(): InterceptorConfig[] {
		return [...this.interceptors]
	}

	sendMessage(message: { type?: string; action?: string }): { intercepted: boolean; response?: unknown } {
		const match = this.interceptors.find(
			(i) => i.direction === "send" && i.type === message.type && (!i.action || i.action === message.action),
		)
		if (match) {
			this.trace.push({
				timestamp: Date.now(),
				direction: "send",
				type: message.type ?? "unknown",
				action: message.action,
				payload: JSON.stringify(message),
				intercepted: true,
			})
			this.trimTrace()
			return { intercepted: true, response: match.response }
		}
		return { intercepted: false }
	}

	receiveMessage(message: { type?: string; action?: string }): { intercepted: boolean; response?: unknown } {
		const match = this.interceptors.find(
			(i) => i.direction === "receive" && i.type === message.type && (!i.action || i.action === message.action),
		)
		if (match) {
			this.trace.push({
				timestamp: Date.now(),
				direction: "receive",
				type: message.type ?? "unknown",
				action: message.action,
				payload: JSON.stringify(message),
				intercepted: true,
			})
			this.trimTrace()
			return { intercepted: true, response: match.response }
		}
		return { intercepted: false }
	}

	getTrace(filter?: TraceFilter, limit?: number): { entries: TraceEntry[]; totalCount: number } {
		let entries = this.trace
		if (filter) {
			if (filter.direction) {
				entries = entries.filter((e) => e.direction === filter.direction)
			}
			if (filter.type) {
				entries = entries.filter((e) => e.type === filter.type)
			}
			if (filter.action) {
				entries = entries.filter((e) => e.action === filter.action)
			}
		}
		const totalCount = entries.length
		if (limit && limit > 0) {
			entries = entries.slice(-limit)
		}
		return { entries, totalCount }
	}

	clearTrace(): void {
		this.trace = []
	}

	private check(direction: string, type: string, action?: string): InterceptorConfig | undefined {
		return this.interceptors.find(
			(i) => i.direction === direction && i.type === type && (!i.action || i.action === action),
		)
	}

	private trimTrace(): void {
		if (this.trace.length > this.maxTraceSize) {
			this.trace = this.trace.slice(-this.maxTraceSize)
		}
	}
}
