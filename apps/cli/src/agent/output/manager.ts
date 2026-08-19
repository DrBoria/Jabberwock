import { Notification } from "@jabberwock/types"
import { Observable } from "../events/observable.js"

import type { OutputManagerOptions } from "./types.js"
import { MessageOutputHandlers } from "./message-handlers.js"

export class OutputManager {
	private disabled: boolean
	private handlers: MessageOutputHandlers
	private loggedFirstPartial = new Set<number>()
	public readonly streamingState = new Observable<{ ts: number | null; isStreaming: boolean }>({
		ts: null,
		isStreaming: false,
	})

	constructor(options: OutputManagerOptions = {}) {
		this.disabled = options.disabled ?? false
		const stdout = options.stdout ?? process.stdout
		const stderr = options.stderr ?? process.stderr
		this.handlers = new MessageOutputHandlers(stdout, stderr)
	}

	outputMessage(msg: Notification, skipFirstUserMessage = true): void {
		const ts = msg.ts
		const text = msg.text || ""
		const isPartial = msg.partial === true
		const prev = this.handlers.displayedMessages.get(ts)
		const alreadyDisplayedComplete = prev !== undefined && !prev.partial
		if (msg.type === "say" && msg.say) {
			this.handlers.outputSayMessage(ts, msg.say, text, isPartial, alreadyDisplayedComplete, skipFirstUserMessage)
		} else if (msg.type === "ask" && msg.ask === "command_output") {
			this.handlers.outputCommandOutputMessage(ts, text, isPartial, alreadyDisplayedComplete)
		}
	}

	output(label: string, text?: string): void {
		if (this.disabled) return
		process.stdout.write(text ? `${label} ${text}\n` : `${label}\n`)
	}

	outputError(label: string, text?: string): void {
		if (this.disabled) return
		process.stderr.write(text ? `${label} ${text}\n` : `${label}\n`)
	}

	writeRaw(text: string): void {
		if (this.disabled) return
		process.stdout.write(text)
	}

	isAlreadyDisplayed(ts: number): boolean {
		return this.handlers.displayedMessages.get(ts)?.partial === false
	}

	isCurrentlyStreaming(): boolean {
		return this.handlers.currentlyStreamingTs !== null
	}

	getCurrentlyStreamingTs(): number | null {
		return this.handlers.currentlyStreamingTs
	}

	markDisplayed(ts: number, text: string, partial: boolean): void {
		this.handlers.displayedMessages.set(ts, { ts, text, partial })
	}

	clear(): void {
		this.handlers.displayedMessages.clear()
		this.handlers.streamedContent.clear()
		this.handlers.currentlyStreamingTs = null
		this.handlers.completionResultStreamed = false
		this.loggedFirstPartial.clear()
		this.streamingState.next({ ts: null, isStreaming: false })
	}

	hasLoggedFirstPartial(ts: number): boolean {
		return this.loggedFirstPartial.has(ts)
	}

	setLoggedFirstPartial(ts: number): void {
		this.loggedFirstPartial.add(ts)
	}

	clearLoggedFirstPartial(ts: number): void {
		this.loggedFirstPartial.delete(ts)
	}

	outputCommandOutput(
		ts: number,
		text: string,
		isPartial: boolean,
		alreadyDisplayedComplete: boolean | undefined,
	): void {
		this.handlers.outputCommandOutputMessage(ts, text, isPartial, alreadyDisplayedComplete)
	}

	streamContent(ts: number, text: string, header: string): void {
		const prev = this.handlers.streamedContent.get(ts)
		if (!prev) {
			this.handlers.streamContent(ts, text, header)
			this.streamingState.next({ ts, isStreaming: true })
		} else {
			this.handlers.streamContent(ts, text, header)
		}
	}

	finishStream(ts: number): void {
		if (this.handlers.currentlyStreamingTs === ts) {
			this.handlers.finishStream(ts)
			this.streamingState.next({ ts: null, isStreaming: false })
		}
	}

	outputCompletionResult(ts: number, text: string): void {
		this.handlers.outputCompletionResult(ts, text)
	}
}
