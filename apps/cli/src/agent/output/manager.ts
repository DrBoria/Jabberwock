import { Notification } from "@jabberwock/types"
import { createObservable } from "../events/observable.js"

import type { OutputManagerOptions } from "./types.js"
import { createMessageOutputHandlers, type MessageOutputHandlers } from "./message-handlers.js"

export function createOutputManager(options: OutputManagerOptions = {}) {
	const disabled = options.disabled ?? false
	const stdout = options.stdout ?? process.stdout
	const stderr = options.stderr ?? process.stderr
	const handlers: MessageOutputHandlers = createMessageOutputHandlers(stdout, stderr)
	const loggedFirstPartial = new Set<number>()
	const streamingState = createObservable<{ ts: number | null; isStreaming: boolean }>({
		ts: null,
		isStreaming: false,
	})

	function outputMessage(msg: Notification, skipFirstUserMessage = true): void {
		const ts = msg.ts
		const text = msg.text || ""
		const isPartial = msg.partial === true
		const prev = handlers.displayedMessages.get(ts)
		const alreadyDisplayedComplete = prev !== undefined && !prev.partial
		if (msg.type === "say" && msg.say) {
			handlers.outputSayMessage(ts, msg.say, text, isPartial, alreadyDisplayedComplete, skipFirstUserMessage)
		} else if (msg.type === "ask" && msg.ask === "command_output") {
			handlers.outputCommandOutputMessage(ts, text, isPartial, alreadyDisplayedComplete)
		}
	}

	function output(label: string, text?: string): void {
		if (disabled) return
		process.stdout.write(text ? `${label} ${text}\n` : `${label}\n`)
	}

	function outputError(label: string, text?: string): void {
		if (disabled) return
		process.stderr.write(text ? `${label} ${text}\n` : `${label}\n`)
	}

	function writeRaw(text: string): void {
		if (disabled) return
		process.stdout.write(text)
	}

	function isAlreadyDisplayed(ts: number): boolean {
		return handlers.displayedMessages.get(ts)?.partial === false
	}

	function isCurrentlyStreaming(): boolean {
		return handlers.currentlyStreamingTs !== null
	}

	function getCurrentlyStreamingTs(): number | null {
		return handlers.currentlyStreamingTs
	}

	function markDisplayed(ts: number, text: string, partial: boolean): void {
		handlers.displayedMessages.set(ts, { ts, text, partial })
	}

	function clear(): void {
		handlers.displayedMessages.clear()
		handlers.streamedContent.clear()
		handlers.currentlyStreamingTs = null
		handlers.completionResultStreamed = false
		loggedFirstPartial.clear()
		streamingState.next({ ts: null, isStreaming: false })
	}

	function hasLoggedFirstPartial(ts: number): boolean {
		return loggedFirstPartial.has(ts)
	}

	function setLoggedFirstPartial(ts: number): void {
		loggedFirstPartial.add(ts)
	}

	function clearLoggedFirstPartial(ts: number): void {
		loggedFirstPartial.delete(ts)
	}

	function outputCommandOutput(
		ts: number,
		text: string,
		isPartial: boolean,
		alreadyDisplayedComplete: boolean | undefined,
	): void {
		handlers.outputCommandOutputMessage(ts, text, isPartial, alreadyDisplayedComplete)
	}

	function streamContent(ts: number, text: string, header: string): void {
		const prev = handlers.streamedContent.get(ts)
		if (!prev) {
			handlers.streamContent(ts, text, header)
			streamingState.next({ ts, isStreaming: true })
		} else {
			handlers.streamContent(ts, text, header)
		}
	}

	function finishStream(ts: number): void {
		if (handlers.currentlyStreamingTs === ts) {
			handlers.finishStream(ts)
			streamingState.next({ ts: null, isStreaming: false })
		}
	}

	function outputCompletionResult(ts: number, text: string): void {
		handlers.outputCompletionResult(ts, text)
	}

	return {
		streamingState,
		outputMessage,
		output,
		outputError,
		writeRaw,
		isAlreadyDisplayed,
		isCurrentlyStreaming,
		getCurrentlyStreamingTs,
		markDisplayed,
		clear,
		hasLoggedFirstPartial,
		setLoggedFirstPartial,
		clearLoggedFirstPartial,
		outputCommandOutput,
		streamContent,
		finishStream,
		outputCompletionResult,
	}
}

/** OutputManager instance type */
export type OutputManager = ReturnType<typeof createOutputManager>
