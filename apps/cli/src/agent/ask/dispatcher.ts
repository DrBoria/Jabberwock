import { type Notification, type AskResponseValue } from "@jabberwock/types"
import { debugLog } from "@jabberwock/core/cli"

import type { WebviewMessage } from "@jabberwock/types"
import type { OutputManager } from "../output/manager.js"
import type { PromptManager } from "../prompt-manager/prompt-manager.js"
import { AskHandlerDelegator } from "./handlers.js"
import { getMessageText, toError } from "./dispatcher-utils.js"

export class AskDispatcher {
	private outputManager: OutputManager
	private promptManager: PromptManager
	private sendMessage: (message: WebviewMessage) => void
	private nonInteractive: boolean
	private exitOnError: boolean
	private disabled: boolean
	private handledAsks = new Set<number>()
	private delegator: AskHandlerDelegator

	constructor(options: {
		outputManager: OutputManager
		promptManager: PromptManager
		sendMessage: (message: WebviewMessage) => void
		nonInteractive?: boolean
		exitOnError?: boolean
		disabled?: boolean
	}) {
		this.outputManager = options.outputManager
		this.promptManager = options.promptManager
		this.sendMessage = options.sendMessage
		this.nonInteractive = options.nonInteractive ?? false
		this.exitOnError = options.exitOnError ?? false
		this.disabled = options.disabled ?? false
		this.delegator = new AskHandlerDelegator(
			{
				outputManager: options.outputManager,
				promptManager: options.promptManager,
				sendMessage: options.sendMessage,
				nonInteractive: options.nonInteractive,
				exitOnError: options.exitOnError,
			},
			this.handledAsks,
		)
	}

	async handleAsk(message: Notification): Promise<{ handled: boolean; response?: AskResponseValue; error?: Error }> {
		if (this.disabled || this.handledAsks.has(message.ts)) {
			return { handled: !this.disabled }
		}
		const ts = message.ts,
			ask = message.ask
		if (message.type !== "ask" || !ask || message.partial) {
			return { handled: false }
		}
		this.handledAsks.add(ts)
		try {
			const handler = this.delegator.getAskHandler(ask)
			if (handler) {
				return await handler(ts, ask, getMessageText(message))
			}
			debugLog("[AskDispatcher] Unknown ask type", { ask, ts })
			return await this.delegator.handleUnknownAsk(ts, ask, getMessageText(message))
		} catch (error) {
			this.handledAsks.delete(ts)
			return { handled: false, error: toError(error) }
		}
	}

	isHandled(ts: number): boolean {
		return this.handledAsks.has(ts)
	}

	clear(): void {
		this.handledAsks.clear()
	}
}
