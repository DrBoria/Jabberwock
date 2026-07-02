import { NotificationSay } from "@jabberwock/types"

import type { DisplayedMessage, StreamState } from "./types.js"

/**
 * Encapsulates the message-type-specific output formatting logic.
 * Delegated from OutputManager to keep the main file focused on orchestration.
 */
export class MessageOutputHandlers {
	displayedMessages = new Map<number, DisplayedMessage>()
	streamedContent = new Map<number, StreamState>()
	currentlyStreamingTs: number | null = null
	completionResultStreamed = false

	private stdout: NodeJS.WriteStream
	private stderr: NodeJS.WriteStream

	constructor(stdout: NodeJS.WriteStream, stderr: NodeJS.WriteStream) {
		this.stdout = stdout
		this.stderr = stderr
	}

	outputSayMessage(
		ts: number,
		say: NotificationSay,
		text: string,
		isPartial: boolean,
		alreadyDisplayedComplete: boolean | undefined,
		skipFirstUserMessage: boolean,
	): void {
		switch (say) {
			case "text":
				this.outputTextMessage(ts, text, isPartial, alreadyDisplayedComplete, skipFirstUserMessage)
				break
			case "reasoning":
				this.outputReasoningMessage(ts, text, isPartial, alreadyDisplayedComplete)
				break
			case "command_output":
				this.outputCommandOutputMessage(ts, text, isPartial, alreadyDisplayedComplete)
				break
			case "completion_result":
				this.outputCompletionSayMessage(ts, text, isPartial, alreadyDisplayedComplete)
				break
			case "error":
				if (!alreadyDisplayedComplete) {
					this.writeError("\n[error]", text || "Unknown error")
					this.displayedMessages.set(ts, { ts, text: text || "", partial: false })
				}
				break
			case "api_req_started":
				break
			default:
				break
		}
	}

	private outputTextMessage(
		ts: number,
		text: string,
		isPartial: boolean,
		alreadyDisplayedComplete: boolean | undefined,
		skipFirstUserMessage: boolean,
	): void {
		if (skipFirstUserMessage && !this.displayedMessages.size && !this.displayedMessages.has(ts)) {
			this.displayedMessages.set(ts, { ts, text, partial: !!isPartial })
			return
		}
		if (isPartial && text) {
			this.streamContent(ts, text, "[assistant]")
			this.displayedMessages.set(ts, { ts, text, partial: true })
		} else if (!isPartial && text && !alreadyDisplayedComplete) {
			if (!this.streamDelta(ts, text)) {
				this.writeLine("\n[assistant]", text)
			}
			this.displayedMessages.set(ts, { ts, text, partial: false })
			this.streamedContent.set(ts, { ts, text, headerShown: true })
		}
	}

	private outputReasoningMessage(
		ts: number,
		text: string,
		isPartial: boolean,
		alreadyDisplayedComplete: boolean | undefined,
	): void {
		if (isPartial && text) {
			this.streamContent(ts, text, "[reasoning]")
			this.displayedMessages.set(ts, { ts, text, partial: true })
		} else if (!isPartial && text && !alreadyDisplayedComplete) {
			if (!this.streamDelta(ts, text)) {
				this.writeLine("\n[reasoning]", text)
			}
			this.displayedMessages.set(ts, { ts, text, partial: false })
		}
	}

	outputCommandOutputMessage(
		ts: number,
		text: string,
		isPartial: boolean,
		alreadyDisplayedComplete: boolean | undefined,
	): void {
		if (isPartial && text) {
			this.streamContent(ts, text, "[command output]")
			this.displayedMessages.set(ts, { ts, text, partial: true })
		} else if (!isPartial && text && !alreadyDisplayedComplete) {
			if (!this.streamDelta(ts, text)) {
				this.writeRaw("\n[command output] ")
				this.writeRaw(text)
				this.writeRaw("\n")
			}
			this.displayedMessages.set(ts, { ts, text, partial: false })
			this.streamedContent.set(ts, { ts, text, headerShown: true })
		}
	}

	streamContent(ts: number, text: string, header: string): void {
		const previous = this.streamedContent.get(ts)
		if (!previous) {
			this.writeRaw(`\n${header} `)
			this.writeRaw(text)
			this.currentlyStreamingTs = ts
		} else if (text.length > previous.text.length && text.startsWith(previous.text)) {
			const delta = text.slice(previous.text.length)
			this.writeRaw(delta)
		}
		this.streamedContent.set(ts, { ts, text, headerShown: true })
	}

	streamDelta(ts: number, text: string): boolean {
		const streamed = this.streamedContent.get(ts)
		if (!streamed) {
			return false
		}
		if (text.length > streamed.text.length && text.startsWith(streamed.text)) {
			this.writeRaw(text.slice(streamed.text.length))
		}
		this.finishStream(ts)
		return true
	}

	finishStream(ts: number): void {
		if (this.currentlyStreamingTs === ts) {
			this.writeRaw("\n")
			this.currentlyStreamingTs = null
		}
	}

	private outputCompletionSayMessage(
		ts: number,
		text: string,
		isPartial: boolean,
		alreadyDisplayedComplete: boolean | undefined,
	): void {
		if (isPartial && text) {
			this.streamContent(ts, text, "[assistant]")
			this.displayedMessages.set(ts, { ts, text, partial: true })
		} else if (!isPartial && text && !alreadyDisplayedComplete) {
			if (!this.streamDelta(ts, text)) {
				this.writeLine("\n[assistant]", text)
			}
			this.displayedMessages.set(ts, { ts, text, partial: false })
		}
		this.completionResultStreamed = true
	}

	outputCompletionResult(ts: number, text: string): void {
		const previousDisplay = this.displayedMessages.get(ts)
		if (!previousDisplay || previousDisplay.partial) {
			this.writeLine("\n[task complete]", this.completionResultStreamed ? undefined : text || "")
			this.displayedMessages.set(ts, { ts, text: text || "", partial: false })
		}
	}

	private writeLine(label: string, text?: string): void {
		this.stdout.write(text ? `${label} ${text}\n` : `${label}\n`)
	}

	private writeRaw(text: string): void {
		this.stdout.write(text)
	}

	private writeError(label: string, text?: string): void {
		this.stderr.write(text ? `${label} ${text}\n` : `${label}\n`)
	}
}
