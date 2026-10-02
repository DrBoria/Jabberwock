import { type Notification, type AskResponseValue } from "@jabberwock/types"
import { debugLog } from "@jabberwock/core/cli"

import type { WebviewMessage } from "@jabberwock/types"
import type { OutputManager } from "../output/manager.js"
import type { PromptManager } from "../prompt-manager/manager.js"
import { createAskHandlerDelegator, type AskHandlerDelegator } from "./delegator.js"
import { getMessageText, toError } from "./helpers.js"

export function createAskDispatcher(options: {
	outputManager: OutputManager
	promptManager: PromptManager
	sendMessage: (message: WebviewMessage) => void
	nonInteractive?: boolean
	exitOnError?: boolean
	disabled?: boolean
}) {
	const handledAsks = new Set<number>()
	const delegator: AskHandlerDelegator = createAskHandlerDelegator({
		outputManager: options.outputManager,
		promptManager: options.promptManager,
		sendMessage: options.sendMessage,
		nonInteractive: options.nonInteractive,
		exitOnError: options.exitOnError,
	})
	const disabled = options.disabled ?? false

	async function handleAsk(
		message: Notification,
	): Promise<{ handled: boolean; response?: AskResponseValue; error?: Error }> {
		if (disabled || handledAsks.has(message.ts)) {
			return { handled: !disabled }
		}
		const ts = message.ts,
			ask = message.ask
		if (message.type !== "ask" || !ask || message.partial) {
			return { handled: false }
		}
		handledAsks.add(ts)
		try {
			const handler = delegator.getAskHandler(ask)
			if (handler) {
				return await handler(ts, ask, getMessageText(message))
			}
			debugLog("[AskDispatcher] Unknown ask type", { ask, ts })
			return await delegator.handleUnknownAsk(ts, ask, getMessageText(message))
		} catch (error) {
			handledAsks.delete(ts)
			return { handled: false, error: toError(error) }
		}
	}

	function isHandled(ts: number): boolean {
		return handledAsks.has(ts)
	}

	function clear(): void {
		handledAsks.clear()
	}

	return { handleAsk, isHandled, clear }
}

/** AskDispatcher instance type */
export type AskDispatcher = ReturnType<typeof createAskDispatcher>
