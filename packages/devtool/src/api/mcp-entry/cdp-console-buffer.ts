/**
 * CDP console-event handling for the renderer console listener.
 *
 * Owns the ring buffer of captured console entries and the session→label map,
 * and parses the flatten-session CDP messages (Target/Runtime/Log) that the
 * browser-level endpoint emits. Kept separate from the socket/connection
 * lifecycle in `renderer-console.ts` to keep each file small.
 */

export type Level = "error" | "warn" | "info" | "debug" | "log"

export interface ConsoleEntry {
	timestamp: number
	target: string
	level: Level
	text: string
}

const MAX_ENTRIES = 3000

function normalizeLevel(raw: string): Level {
	switch (raw) {
		case "error":
			return "error"
		case "warning":
		case "warn":
			return "warn"
		case "info":
			return "info"
		case "debug":
			return "debug"
		default:
			return "log"
	}
}

function argObjectToText(a: Record<string, unknown>): string {
	if (typeof a.unserializableValue === "string") return a.unserializableValue
	if (typeof a.description === "string") return a.description
	if (a.value !== undefined) return String(a.value)
	if (a.type === "object" && a.preview) {
		const props = (a.preview as { properties?: Array<{ name: string }> }).properties
		if (Array.isArray(props) && props.length > 0) {
			return `{${props.map((p) => p.name).join(", ")}}`
		}
	}
	return JSON.stringify(a).slice(0, 200)
}

function argToText(arg: unknown): string {
	if (arg == null) return String(arg)
	if (typeof arg === "string") return arg
	if (typeof arg === "number" || typeof arg === "boolean") return String(arg)
	if (typeof arg === "object") return argObjectToText(arg as Record<string, unknown>)
	return String(arg)
}

function labelForUrl(url: string): string {
	if (/vscode-webview/i.test(url) || /purpose=webview/i.test(url)) return "vscode-surface"
	if (/workbench\.desktop\.main\.html|workbench\.html|\/out\/vs\/workbench/i.test(url)) return "workbench"
	return "renderer"
}

interface ParsedCdpMessage {
	method: string
	sessionId?: string
	params: Record<string, unknown>
}

function parseCdpMessage(raw: unknown): ParsedCdpMessage | null {
	let msg: Record<string, unknown>
	try {
		msg = JSON.parse(typeof raw === "string" ? raw : (raw as Buffer).toString())
	} catch {
		return null
	}
	const method = msg.method as string | undefined
	if (typeof method !== "string") return null
	return {
		method,
		sessionId: (msg.sessionId as string | undefined) ?? undefined,
		params: (msg.params ?? {}) as Record<string, unknown>,
	}
}

export class CdpConsoleBuffer {
	readonly entries: ConsoleEntry[] = []
	private sessionIdLabel = new Map<string, string>()
	private msgId = 0

	constructor(private readonly sendFn: (data: string) => void) {}

	get connectedTargets(): string[] {
		return [...this.sessionIdLabel.values()]
	}

	private push(target: string, level: Level, text: string): void {
		if (!text) return
		this.entries.push({ timestamp: Date.now(), target, level, text })
		if (this.entries.length > MAX_ENTRIES) this.entries.splice(0, this.entries.length - MAX_ENTRIES)
	}

	private nextId(): number {
		this.msgId += 1
		return this.msgId
	}

	private send(method: string, params?: Record<string, unknown>, sessionId?: string): void {
		const payload: Record<string, unknown> = { id: this.nextId(), method }
		if (params) payload.params = params
		if (sessionId) payload.sessionId = sessionId
		try {
			this.sendFn(JSON.stringify(payload))
		} catch {
			// socket closed mid-send — ignore
		}
	}

	private handleTargetEvent(method: string, sessionId: string | undefined, params: Record<string, unknown>): boolean {
		if (method === "Target.attachedToTarget") {
			const info = (params.targetInfo ?? {}) as { url?: string; type?: string }
			const label = labelForUrl(info.url ?? "")
			if (sessionId) this.sessionIdLabel.set(sessionId, label)
			// Enable console capture on the newly attached target.
			this.send("Runtime.enable", undefined, sessionId)
			this.send("Log.enable", undefined, sessionId)
			return true
		}
		if (method === "Target.detachedFromTarget") {
			if (sessionId) this.sessionIdLabel.delete(sessionId)
			return true
		}
		return false
	}

	private handleRuntimeEvent(method: string, target: string, params: Record<string, unknown>): boolean {
		if (method === "Runtime.consoleAPICalled") {
			const type = (params.type as string) ?? "log"
			const args = (params.args as unknown[]) ?? []
			const text = args.map(argToText).join(" ")
			this.push(target, normalizeLevel(type), text)
			return true
		}
		if (method === "Runtime.exceptionThrown") {
			const details = (params.exceptionDetails ?? {}) as {
				text?: string
				exception?: { description?: string }
			}
			const text = details.exception?.description ?? details.text ?? "uncaught exception"
			this.push(target, "error", text)
			return true
		}
		return false
	}

	private handleLogEvent(method: string, target: string, params: Record<string, unknown>): boolean {
		if (method === "Log.entryAdded") {
			const entry = (params.entry ?? {}) as { level?: string; text?: string }
			this.push(target, normalizeLevel(entry.level ?? "info"), entry.text ?? "")
			return true
		}
		return false
	}

	handleWsMessage(raw: unknown): void {
		const msg = parseCdpMessage(raw)
		if (!msg) return

		if (msg.method.startsWith("Target.")) {
			this.handleTargetEvent(msg.method, msg.sessionId, msg.params)
			return
		}

		const target = (msg.sessionId && this.sessionIdLabel.get(msg.sessionId)) || "renderer"

		if (msg.method.startsWith("Runtime.")) {
			this.handleRuntimeEvent(msg.method, target, msg.params)
			return
		}
		if (msg.method.startsWith("Log.")) {
			this.handleLogEvent(msg.method, target, msg.params)
		}
	}

	clear(): void {
		this.entries.length = 0
		this.sessionIdLabel.clear()
	}
}
