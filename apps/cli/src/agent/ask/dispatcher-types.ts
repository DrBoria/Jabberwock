import type { WebviewMessage, AskResponseValue } from "@jabberwock/types"
import type { OutputManager } from "../output/manager.js"
import type { PromptManager } from "../prompt-manager/prompt-manager.js"

export interface AskDispatcherOptions {
	outputManager: OutputManager
	promptManager: PromptManager
	sendMessage: (message: WebviewMessage) => void
	nonInteractive?: boolean
	exitOnError?: boolean
	disabled?: boolean
}

export interface AskHandleResult {
	handled: boolean
	response?: AskResponseValue
	error?: Error
}
