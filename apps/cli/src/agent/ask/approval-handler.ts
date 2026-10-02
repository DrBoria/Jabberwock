import type { OutputManager } from "../output/manager.js"
import type { PromptManager } from "../prompt-manager/manager.js"
import type { NotificationAsk, WebviewMessage } from "@jabberwock/types"
import type { AskHandleResult } from "./types.js"
import { safeJsonParse, parseMcpInfo, formatDisplayValue } from "./helpers.js"

export function createAskApprovalHandler(options: {
	outputManager: OutputManager
	promptManager: PromptManager
	sendMessage: (message: WebviewMessage) => void
	nonInteractive: boolean
	exitOnError: boolean
}) {
	const outputManager = options.outputManager
	const promptManager = options.promptManager
	const sendMessage = options.sendMessage
	const nonInteractive = options.nonInteractive
	const exitOnError = options.exitOnError

	function sendApprovalResponse(approved: boolean): void {
		sendMessage({ type: "askResponse", askResponse: approved ? "yesButtonClicked" : "noButtonClicked" })
	}

	async function promptApproval(prompt: string): Promise<AskHandleResult> {
		try {
			const approved = await promptManager.promptForYesNo(prompt)
			sendApprovalResponse(approved)
			return { handled: true, response: approved ? "yesButtonClicked" : "noButtonClicked" }
		} catch {
			outputManager.output("[Defaulting to: no]")
			sendApprovalResponse(false)
			return { handled: true, response: "noButtonClicked" }
		}
	}

	async function handleCommandApproval(ts: number, text: string): Promise<AskHandleResult> {
		outputManager.output("\n[command request]")
		outputManager.output(`  Command: ${text || "(no command specified)"}`)
		outputManager.markDisplayed(ts, text || "", false)
		if (nonInteractive) {
			return { handled: true }
		}
		return await promptApproval("Execute this command? (y/n): ")
	}

	async function handleToolApproval(ts: number, text: string): Promise<AskHandleResult> {
		const toolInfo = safeJsonParse<Record<string, unknown>>(text, {})
		const toolName = (toolInfo.tool as string) || "unknown"
		const isProtected = toolInfo.isProtected === true
		if (isProtected) {
			outputManager.output(`\n[Tool Request] ${toolName} [PROTECTED CONFIGURATION FILE]`)
			outputManager.output(
				"⚠️  WARNING: This tool wants to modify a protected configuration file.\n    Protected files include .jabberwockignore, .jabberwock/*, and other sensitive config files.",
			)
		} else {
			outputManager.output(`\n[Tool Request] ${toolName}`)
		}
		for (const [key, value] of Object.entries(toolInfo)) {
			if (key === "tool" || key === "isProtected") {
				continue
			}
			outputManager.output(`  ${key}: ${formatDisplayValue(value)}`)
		}
		outputManager.markDisplayed(ts, text || "", false)
		if (nonInteractive) {
			return { handled: true }
		}
		return await promptApproval("Approve this action? (y/n): ")
	}

	async function handleMcpApproval(ts: number, text: string): Promise<AskHandleResult> {
		const { serverName, toolName, resourceUri } = parseMcpInfo(text)
		outputManager.output("\n[mcp request]")
		outputManager.output(`  Server: ${serverName}`)
		if (toolName) {
			outputManager.output(`  Tool: ${toolName}`)
		}
		if (resourceUri) {
			outputManager.output(`  Resource: ${resourceUri}`)
		}
		outputManager.markDisplayed(ts, text || "", false)
		if (nonInteractive) {
			return { handled: true }
		}
		return await promptApproval("Allow MCP access? (y/n): ")
	}

	async function handleApiFailedRetry(ts: number, text: string): Promise<AskHandleResult> {
		outputManager.output("\n[api request failed]")
		outputManager.output(`  Error: ${text || "Unknown error"}`)
		outputManager.markDisplayed(ts, text || "", false)
		if (exitOnError) {
			console.error(`[CLI] API request failed: ${text || "Unknown error"}`)
			process.exit(1)
		}
		if (nonInteractive) {
			outputManager.output("\n[retrying api request]")
			return { handled: true }
		}
		return await promptApproval("Retry the request? (y/n): ")
	}

	async function handleMistakeLimitReached(ts: number, text: string): Promise<AskHandleResult> {
		outputManager.output("\n[mistake limit reached]")
		if (text) {
			outputManager.output(`  Details: ${text}`)
		}
		outputManager.markDisplayed(ts, text || "", false)
		if (nonInteractive) {
			sendApprovalResponse(true)
			return { handled: true, response: "yesButtonClicked" }
		}
		return await promptApproval("Continue anyway? (y/n): ")
	}

	async function handleAutoApprovalMaxReached(ts: number, text: string): Promise<AskHandleResult> {
		outputManager.output("\n[auto-approval limit reached]")
		if (text) {
			outputManager.output(`  Details: ${text}`)
		}
		outputManager.markDisplayed(ts, text || "", false)
		if (nonInteractive) {
			sendApprovalResponse(true)
			return { handled: true, response: "yesButtonClicked" }
		}
		return await promptApproval("Continue with manual approval? (y/n): ")
	}

	async function handleResumeTask(ts: number, ask: NotificationAsk, text: string): Promise<AskHandleResult> {
		const isCompleted = ask === "resume_completed_task"
		outputManager.output(`\n[Resume ${isCompleted ? "Completed " : ""}Task]`)
		if (text) {
			outputManager.output(`  ${text}`)
		}
		outputManager.markDisplayed(ts, text || "", false)
		if (nonInteractive) {
			outputManager.output("\n[continuing task]")
			sendApprovalResponse(true)
			return { handled: true, response: "yesButtonClicked" }
		}
		return await promptApproval("Continue with this task? (y/n): ")
	}

	async function handleGenericApproval(ts: number, ask: NotificationAsk, text: string): Promise<AskHandleResult> {
		outputManager.output(`\n[${ask}]`)
		if (text) {
			outputManager.output(`  ${text}`)
		}
		outputManager.markDisplayed(ts, text || "", false)
		if (nonInteractive) {
			return { handled: true }
		}
		return await promptApproval("Approve? (y/n): ")
	}

	return {
		handleCommandApproval,
		handleToolApproval,
		handleMcpApproval,
		handleApiFailedRetry,
		handleMistakeLimitReached,
		handleAutoApprovalMaxReached,
		handleResumeTask,
		handleGenericApproval,
	}
}

/** AskApprovalHandler instance type */
export type AskApprovalHandler = ReturnType<typeof createAskApprovalHandler>
