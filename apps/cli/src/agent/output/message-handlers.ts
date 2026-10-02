import { NotificationSay } from "@jabberwock/types"

import type { DisplayedMessage, StreamState } from "./types.js"

/**
 * Encapsulates the message-type-specific output formatting logic.
 * Delegated from "OutputManager" to keep the main file focused on orchestration.
 */
export function createMessageOutputHandlers(stdout: NodeJS.WriteStream, stderr: NodeJS.WriteStream) {
	const displayedMessages = new Map<number, DisplayedMessage>()
	const streamedContent = new Map<number, StreamState>()
	let currentlyStreamingTs: number | null = null
	let completionResultStreamed = false

	function outputSayMessage(
		ts: number,
		say: NotificationSay,
		text: string,
		isPartial: boolean,
		alreadyDisplayedComplete: boolean | undefined,
		skipFirstUserMessage: boolean,
	): void {
		switch (say) {
			case "text":
				outputTextMessage(ts, text, isPartial, alreadyDisplayedComplete, skipFirstUserMessage)
				break
			case "reasoning":
				outputReasoningMessage(ts, text, isPartial, alreadyDisplayedComplete)
				break
			case "command_output":
				outputCommandOutputMessage(ts, text, isPartial, alreadyDisplayedComplete)
				break
			case "completion_result":
				outputCompletionSayMessage(ts, text, isPartial, alreadyDisplayedComplete)
				break
			case "error":
				if (!alreadyDisplayedComplete) {
					writeError("\n[error]", text || "Unknown error")
					displayedMessages.set(ts, { ts, text: text || "", partial: false })
				}
				break
			case "api_req_started":
				break
			default:
				break
		}
	}

	function outputTextMessage(
		ts: number,
		text: string,
		isPartial: boolean,
		alreadyDisplayedComplete: boolean | undefined,
		skipFirstUserMessage: boolean,
	): void {
		if (skipFirstUserMessage && !displayedMessages.size && !displayedMessages.has(ts)) {
			displayedMessages.set(ts, { ts, text, partial: !!isPartial })
			return
		}
		if (isPartial && text) {
			streamContent(ts, text, "[assistant]")
			displayedMessages.set(ts, { ts, text, partial: true })
		} else if (!isPartial && text && !alreadyDisplayedComplete) {
			if (!streamDelta(ts, text)) {
				writeLine("\n[assistant]", text)
			}
			displayedMessages.set(ts, { ts, text, partial: false })
			streamedContent.set(ts, { ts, text, headerShown: true })
		}
	}

	function outputReasoningMessage(
		ts: number,
		text: string,
		isPartial: boolean,
		alreadyDisplayedComplete: boolean | undefined,
	): void {
		if (isPartial && text) {
			streamContent(ts, text, "[reasoning]")
			displayedMessages.set(ts, { ts, text, partial: true })
		} else if (!isPartial && text && !alreadyDisplayedComplete) {
			if (!streamDelta(ts, text)) {
				writeLine("\n[reasoning]", text)
			}
			displayedMessages.set(ts, { ts, text, partial: false })
		}
	}

	function outputCommandOutputMessage(
		ts: number,
		text: string,
		isPartial: boolean,
		alreadyDisplayedComplete: boolean | undefined,
	): void {
		if (isPartial && text) {
			streamContent(ts, text, "[command output]")
			displayedMessages.set(ts, { ts, text, partial: true })
		} else if (!isPartial && text && !alreadyDisplayedComplete) {
			if (!streamDelta(ts, text)) {
				writeRaw("\n[command output] ")
				writeRaw(text)
				writeRaw("\n")
			}
			displayedMessages.set(ts, { ts, text, partial: false })
			streamedContent.set(ts, { ts, text, headerShown: true })
		}
	}

	function streamContent(ts: number, text: string, header: string): void {
		const previous = streamedContent.get(ts)
		if (!previous) {
			writeRaw(`\n${header} `)
			writeRaw(text)
			currentlyStreamingTs = ts
		} else if (text.length > previous.text.length && text.startsWith(previous.text)) {
			const delta = text.slice(previous.text.length)
			writeRaw(delta)
		}
		streamedContent.set(ts, { ts, text, headerShown: true })
	}

	function streamDelta(ts: number, text: string): boolean {
		const streamed = streamedContent.get(ts)
		if (!streamed) {
			return false
		}
		if (text.length > streamed.text.length && text.startsWith(streamed.text)) {
			writeRaw(text.slice(streamed.text.length))
		}
		finishStream(ts)
		return true
	}

	function finishStream(ts: number): void {
		if (currentlyStreamingTs === ts) {
			writeRaw("\n")
			currentlyStreamingTs = null
		}
	}

	function outputCompletionSayMessage(
		ts: number,
		text: string,
		isPartial: boolean,
		alreadyDisplayedComplete: boolean | undefined,
	): void {
		if (isPartial && text) {
			streamContent(ts, text, "[assistant]")
			displayedMessages.set(ts, { ts, text, partial: true })
		} else if (!isPartial && text && !alreadyDisplayedComplete) {
			if (!streamDelta(ts, text)) {
				writeLine("\n[assistant]", text)
			}
			displayedMessages.set(ts, { ts, text, partial: false })
		}
		completionResultStreamed = true
	}

	function outputCompletionResult(ts: number, text: string): void {
		const previousDisplay = displayedMessages.get(ts)
		if (!previousDisplay || previousDisplay.partial) {
			writeLine("\n[task complete]", completionResultStreamed ? undefined : text || "")
			displayedMessages.set(ts, { ts, text: text || "", partial: false })
		}
	}

	function writeLine(label: string, text?: string): void {
		stdout.write(text ? `${label} ${text}\n` : `${label}\n`)
	}

	function writeRaw(text: string): void {
		stdout.write(text)
	}

	function writeError(label: string, text?: string): void {
		stderr.write(text ? `${label} ${text}\n` : `${label}\n`)
	}

	return {
		displayedMessages,
		streamedContent,
		get currentlyStreamingTs() {
			return currentlyStreamingTs
		},
		set currentlyStreamingTs(value: number | null) {
			currentlyStreamingTs = value
		},
		get completionResultStreamed() {
			return completionResultStreamed
		},
		set completionResultStreamed(value: boolean) {
			completionResultStreamed = value
		},
		outputSayMessage,
		outputCommandOutputMessage,
		streamContent,
		streamDelta,
		finishStream,
		outputCompletionResult,
	}
}

/** MessageOutputHandlers instance type */
export type MessageOutputHandlers = ReturnType<typeof createMessageOutputHandlers>
