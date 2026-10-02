import { debugLog } from "@jabberwock/core/cli"

import type { JabberwockSettings } from "@jabberwock/types"
import { DEFAULT_FLAGS } from "@/types/index.js"
import { getProviderSettings } from "@/lib/utils/validation/provider.js"

import type { Notification } from "@jabberwock/types"
import type { WaitingForInputEvent, TaskCompletedEvent } from "../events/types.js"
import type { ExtensionHostOptions } from "./types.js"
import type { ExtensionClient } from "./client.js"
import type { OutputManager } from "../output/manager.js"
import type { AskDispatcher } from "../ask/main.js"

export function createExtensionConsoleManager() {
	let originalConsole: {
		log: typeof console.log
		warn: typeof console.warn
		error: typeof console.error
		debug: typeof console.debug
		info: typeof console.info
	} | null = null
	let originalProcessEmitWarning: typeof process.emitWarning | null = null

	function setupQuietMode(integrationTest?: boolean): void {
		if (originalConsole || integrationTest) {
			return
		}
		originalProcessEmitWarning = process.emitWarning
		process.emitWarning = () => {}
		process.on("warning", () => {})
		originalConsole = {
			log: console.log,
			warn: console.warn,
			error: console.error,
			debug: console.debug,
			info: console.info,
		}
		console.log = () => {}
		console.warn = () => {}
		console.debug = () => {}
		console.info = () => {}
	}

	function restoreConsole(): void {
		if (!originalConsole) {
			return
		}
		console.log = originalConsole.log
		console.warn = originalConsole.warn
		console.error = originalConsole.error
		console.debug = originalConsole.debug
		console.info = originalConsole.info
		originalConsole = null
		if (originalProcessEmitWarning) {
			process.emitWarning = originalProcessEmitWarning
			originalProcessEmitWarning = null
		}
	}

	return { setupQuietMode, restoreConsole }
}

/** ExtensionConsoleManager instance type */
export type ExtensionConsoleManager = ReturnType<typeof createExtensionConsoleManager>

export function buildInitialSettings(options: ExtensionHostOptions): JabberwockSettings {
	const baseSettings: JabberwockSettings = {
		mode: options.mode,
		consecutiveMistakeLimit: options.consecutiveMistakeLimit ?? DEFAULT_FLAGS.consecutiveMistakeLimit,
		commandExecutionTimeout: 300,
		enableCheckpoints: false,
		experiments: { customTools: true },
		...getProviderSettings(options.provider, options.apiKey, options.model),
	}
	const settings = options.nonInteractive
		? {
				autoApprovalEnabled: true,
				alwaysAllowReadOnly: true,
				alwaysAllowReadOnlyOutsideWorkspace: true,
				alwaysAllowWrite: true,
				alwaysAllowWriteOutsideWorkspace: true,
				alwaysAllowWriteProtected: true,
				alwaysAllowMcp: true,
				alwaysAllowModeSwitch: true,
				alwaysAllowSubtasks: true,
				alwaysAllowExecute: true,
				allowedCommands: ["*"],
				...baseSettings,
			}
		: { autoApprovalEnabled: false, ...baseSettings }
	if (options.reasoningEffort && options.reasoningEffort !== "unspecified") {
		if (options.reasoningEffort === "disabled") {
			settings.enableReasoningEffort = false
		} else {
			settings.enableReasoningEffort = true
			settings.reasoningEffort = options.reasoningEffort
		}
	}
	if (options.terminalShell) {
		settings.terminalShellIntegrationDisabled = true
		settings.execaShellPath = options.terminalShell
	}
	return settings
}

export function setupClientEventHandlers(
	client: ExtensionClient,
	outputManager: OutputManager,
	askDispatcher: AskDispatcher,
): void {
	client.on("message", (msg: Notification) => {
		logMessageDebug(msg, "new", outputManager)
		outputManager.outputMessage(msg)
	})
	client.on("messageUpdated", (msg: Notification) => {
		logMessageDebug(msg, "updated", outputManager)
		outputManager.outputMessage(msg)
	})
	client.on("waitingForInput", (event: WaitingForInputEvent) => {
		askDispatcher.handleAsk(event.message)
	})
	client.on("taskCompleted", (event: TaskCompletedEvent) => {
		if (event.message && event.message.type === "ask" && event.message.ask === "completion_result") {
			outputManager.outputCompletionResult(event.message.ts, event.message.text || "")
		}
	})
}

export function logMessageDebug(msg: Notification, type: "new" | "updated", outputManager: OutputManager): void {
	if (msg.partial) {
		if (!outputManager.hasLoggedFirstPartial(msg.ts)) {
			outputManager.setLoggedFirstPartial(msg.ts)
			debugLog("[CLI] message:start", { ts: msg.ts, type: msg.say || msg.ask })
		}
	} else {
		debugLog(`[CLI] message:${type === "new" ? "new" : "complete"}`, { ts: msg.ts, type: msg.say || msg.ask })
		outputManager.clearLoggedFirstPartial(msg.ts)
	}
}

export function waitForTaskCompletion(client: ExtensionClient, options: { exitOnError?: boolean }): Promise<void> {
	return new Promise((resolve, reject) => {
		const cleanup = () => {
			client.off("taskCompleted", completeHandler)
			client.off("error", errorHandler)
			if (messageHandler) {
				client.off("message", messageHandler)
			}
		}
		const completeHandler = () => {
			cleanup()
			resolve()
		}
		const errorHandler = (error: Error) => {
			cleanup()
			reject(error)
		}
		let messageHandler: ((msg: Notification) => void) | null = null
		if (options.exitOnError) {
			messageHandler = (msg: Notification) => {
				if (msg.type === "say" && msg.say === "api_req_retry_delayed") {
					cleanup()
					reject(new Error(msg.text?.split("\n")[0] || "API request failed"))
				}
			}
			client.on("message", messageHandler)
		}
		client.once("taskCompleted", completeHandler)
		client.once("error", errorHandler)
	})
}
