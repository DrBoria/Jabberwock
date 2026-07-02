import pWaitFor from "p-wait-for"

import type { FlagOptions } from "@/types/index.js"
import { OutputFormat } from "@/types/index.js"
import { JsonEventEmitter } from "@/agent/json/index.js"

import { isRecord } from "@/lib/utils/validation/guards.js"

import type { ExtensionHostOptions } from "@/agent/index.js"
import { ExtensionHost } from "@/agent/index.js"
import { runStdinStreamMode } from "../../_stdin-stream/index.js"

const JABBERWOCK_MODEL_WARMUP_TIMEOUT_MS = 10_000,
	SIGNAL_ONLY_EXIT_KEEPALIVE_MS = 60_000,
	STREAM_RESUME_WAIT_TIMEOUT_MS = 2_000

export type FlagOptionsWithDebug = FlagOptions & { debug: boolean }

export async function bootstrapResumeForStdinStream(host: ExtensionHost, sessionId: string): Promise<void> {
	host.sendToExtension({ type: "showTaskWithId", text: sessionId })
	await pWaitFor(() => host.client.hasActiveTask() || host.isWaitingForInput(), {
		interval: 25,
		timeout: STREAM_RESUME_WAIT_TIMEOUT_MS,
	}).catch(() => undefined)
}

export async function warmRooModels(host: ExtensionHost): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		let settled = false
		const cleanup = () => {
			clearTimeout(timeoutId)
			host.off("extensionWebviewMessage", onMessage)
		}
		const finish = (fn: () => void) => {
			if (settled) return
			settled = true
			cleanup()
			fn()
		}
		const onMessage = (message: unknown) => {
			if (
				isRecord(message) &&
				message.type === "singleRouterModelFetchResponse" &&
				(message as { models?: unknown }).models !== undefined
			)
				finish(resolve)
		}
		const timeoutId = setTimeout(() => finish(reject), JABBERWOCK_MODEL_WARMUP_TIMEOUT_MS)
		host.on("extensionWebviewMessage", onMessage)
		host.sendToExtension({ type: "requestRooModels" })
	})
}

export function createPrintModeEmitter(
	u: boolean,
	o: OutputFormat,
	r: { current: string | undefined },
): JsonEventEmitter | null {
	if (!u) return null
	return new JsonEventEmitter({ mode: o as "json" | "stream-json", requestIdProvider: () => r.current })
}

export function createPrintModeHelpers(useJsonOutput: boolean, signalOnlyExit: boolean) {
	const streamRequestId: { current: string | undefined } = { current: undefined }
	let keepAliveInterval: NodeJS.Timeout | undefined
	const jsonEmitter = createPrintModeEmitter(useJsonOutput, useJsonOutput ? "stream-json" : "text", streamRequestId)
	const emitRuntimeError = (error: Error, source?: string) => {
		const m = source ? `${source}: ${error.message}` : error.message
		if (useJsonOutput) {
			process.stdout.write(JSON.stringify({ type: "error", id: Date.now(), content: m }) + "\n")
			return
		}
		console.error("[CLI] Error:", m)
		console.error(error.stack)
	}
	const clearKeepAliveInterval = () => {
		if (!keepAliveInterval) return
		clearInterval(keepAliveInterval)
		keepAliveInterval = undefined
	}
	const setStreamRequestId = (id: string | undefined) => {
		streamRequestId.current = id
	}
	const flushStdout = async () => {
		try {
			if (!process.stdout.writable || process.stdout.destroyed) return
			await new Promise<void>((resolve, reject) => {
				process.stdout.write("", (error?: Error | null) => {
					if (error) {
						reject(error)
						return
					}
					resolve()
				})
			})
		} catch {
			/* noop */
		}
	}
	const ensureKeepAliveInterval = () => {
		if (!signalOnlyExit || keepAliveInterval) return
		keepAliveInterval = setInterval(() => {}, SIGNAL_ONLY_EXIT_KEEPALIVE_MS)
	}
	const parkUntilSignal = async (reason: string): Promise<never> => {
		ensureKeepAliveInterval()
		if (!useJsonOutput) {
			console.error(`[CLI] ${reason} (--signal-only-exit active; waiting for SIGINT/SIGTERM).`)
		}
		await new Promise<void>(() => {})
		throw new Error("unreachable")
	}
	return {
		jsonEmitter,
		streamRequestId,
		emitRuntimeError,
		clearKeepAliveInterval,
		setStreamRequestId,
		flushStdout,
		parkUntilSignal,
	}
}

export async function warmupHost(h: ExtensionHost, e: ExtensionHostOptions, f: FlagOptionsWithDebug): Promise<void> {
	await h.activate()
	if (e.provider !== "jabberwock") return
	try {
		await warmRooModels(h)
	} catch (w) {
		if (f.debug) {
			console.error(
				`[CLI] Warning: Jabberwock model warmup failed: ${w instanceof Error ? w.message : String(w)}`,
			)
		}
	}
}

export async function executeTaskWithResume(
	h: ExtensionHost,
	je: JsonEventEmitter | null,
	usp: boolean,
	irr: boolean,
	rrs: string | undefined,
	prompt: string | undefined,
	rcs: string | undefined,
	of: OutputFormat,
	ssr: (id: string | undefined) => void,
): Promise<void> {
	if (je) {
		je.attachToClient(h.client)
	}
	if (usp) {
		if (!je || of !== "stream-json") {
			throw new Error("--stdin-prompt-stream requires --output-format=stream-json to emit control events")
		}
		if (irr) {
			await bootstrapResumeForStdinStream(h, rrs!)
		}
		await runStdinStreamMode({ host: h, jsonEmitter: je, setStreamRequestId: ssr })
	} else {
		if (irr) {
			await h.resumeTask(rrs!)
		} else {
			await h.runTask(prompt!, rcs)
		}
	}
}
