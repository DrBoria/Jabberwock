import type { OutputManager } from "../output/manager.js"
import type { PromptManager } from "../prompt-manager/prompt-manager.js"
import type { NotificationAsk, WebviewMessage } from "@jabberwock/types"
import type { AskHandleResult } from "./dispatcher-types.js"
import { safeJsonParse, parseMcpInfo, formatDisplayValue } from "./dispatcher-utils.js"

export class AskApprovalHandler {
	private outputManager: OutputManager
	private promptManager: PromptManager
	private sendMessage: (message: WebviewMessage) => void
	private nonInteractive: boolean
	private exitOnError: boolean

	constructor(options: {
		outputManager: OutputManager
		promptManager: PromptManager
		sendMessage: (message: WebviewMessage) => void
		nonInteractive: boolean
		exitOnError: boolean
	}) {
		this.outputManager = options.outputManager
		this.promptManager = options.promptManager
		this.sendMessage = options.sendMessage
		this.nonInteractive = options.nonInteractive
		this.exitOnError = options.exitOnError
	}

	private sendApprovalResponse(approved: boolean): void {
		this.sendMessage({ type: "askResponse", askResponse: approved ? "yesButtonClicked" : "noButtonClicked" })
	}

	private async promptApproval(prompt: string): Promise<AskHandleResult> {
		try {
			const approved = await this.promptManager.promptForYesNo(prompt)
			this.sendApprovalResponse(approved)
			return { handled: true, response: approved ? "yesButtonClicked" : "noButtonClicked" }
		} catch {
			this.outputManager.output("[Defaulting to: no]")
			this.sendApprovalResponse(false)
			return { handled: true, response: "noButtonClicked" }
		}
	}

	async handleCommandApproval(ts: number, text: string): Promise<AskHandleResult> {
		this.outputManager.output("\n[command request]")
		this.outputManager.output(`  Command: ${text || "(no command specified)"}`)
		this.outputManager.markDisplayed(ts, text || "", false)
		if (this.nonInteractive) {
			return { handled: true }
		}
		return await this.promptApproval("Execute this command? (y/n): ")
	}

	async handleToolApproval(ts: number, text: string): Promise<AskHandleResult> {
		const toolInfo = safeJsonParse<Record<string, unknown>>(text, {})
		const toolName = (toolInfo.tool as string) || "unknown"
		const isProtected = toolInfo.isProtected === true
		if (isProtected) {
			this.outputManager.output(`\n[Tool Request] ${toolName} [PROTECTED CONFIGURATION FILE]`)
			this.outputManager.output(
				"⚠️  WARNING: This tool wants to modify a protected configuration file.\n    Protected files include .jabberwockignore, .jabberwock/*, and other sensitive config files.",
			)
		} else {
			this.outputManager.output(`\n[Tool Request] ${toolName}`)
		}
		for (const [key, value] of Object.entries(toolInfo)) {
			if (key === "tool" || key === "isProtected") {
				continue
			}
			this.outputManager.output(`  ${key}: ${formatDisplayValue(value)}`)
		}
		this.outputManager.markDisplayed(ts, text || "", false)
		if (this.nonInteractive) {
			return { handled: true }
		}
		return await this.promptApproval("Approve this action? (y/n): ")
	}

	async handleMcpApproval(ts: number, text: string): Promise<AskHandleResult> {
		const { serverName, toolName, resourceUri } = parseMcpInfo(text)
		this.outputManager.output("\n[mcp request]")
		this.outputManager.output(`  Server: ${serverName}`)
		if (toolName) {
			this.outputManager.output(`  Tool: ${toolName}`)
		}
		if (resourceUri) {
			this.outputManager.output(`  Resource: ${resourceUri}`)
		}
		this.outputManager.markDisplayed(ts, text || "", false)
		if (this.nonInteractive) {
			return { handled: true }
		}
		return await this.promptApproval("Allow MCP access? (y/n): ")
	}

	async handleApiFailedRetry(ts: number, text: string): Promise<AskHandleResult> {
		this.outputManager.output("\n[api request failed]")
		this.outputManager.output(`  Error: ${text || "Unknown error"}`)
		this.outputManager.markDisplayed(ts, text || "", false)
		if (this.exitOnError) {
			console.error(`[CLI] API request failed: ${text || "Unknown error"}`)
			process.exit(1)
		}
		if (this.nonInteractive) {
			this.outputManager.output("\n[retrying api request]")
			return { handled: true }
		}
		return await this.promptApproval("Retry the request? (y/n): ")
	}

	async handleMistakeLimitReached(ts: number, text: string): Promise<AskHandleResult> {
		this.outputManager.output("\n[mistake limit reached]")
		if (text) {
			this.outputManager.output(`  Details: ${text}`)
		}
		this.outputManager.markDisplayed(ts, text || "", false)
		if (this.nonInteractive) {
			this.sendApprovalResponse(true)
			return { handled: true, response: "yesButtonClicked" }
		}
		return await this.promptApproval("Continue anyway? (y/n): ")
	}

	async handleAutoApprovalMaxReached(ts: number, text: string): Promise<AskHandleResult> {
		this.outputManager.output("\n[auto-approval limit reached]")
		if (text) {
			this.outputManager.output(`  Details: ${text}`)
		}
		this.outputManager.markDisplayed(ts, text || "", false)
		if (this.nonInteractive) {
			this.sendApprovalResponse(true)
			return { handled: true, response: "yesButtonClicked" }
		}
		return await this.promptApproval("Continue with manual approval? (y/n): ")
	}

	async handleResumeTask(ts: number, ask: NotificationAsk, text: string): Promise<AskHandleResult> {
		const isCompleted = ask === "resume_completed_task"
		this.outputManager.output(`\n[Resume ${isCompleted ? "Completed " : ""}Task]`)
		if (text) {
			this.outputManager.output(`  ${text}`)
		}
		this.outputManager.markDisplayed(ts, text || "", false)
		if (this.nonInteractive) {
			this.outputManager.output("\n[continuing task]")
			this.sendApprovalResponse(true)
			return { handled: true, response: "yesButtonClicked" }
		}
		return await this.promptApproval("Continue with this task? (y/n): ")
	}

	async handleGenericApproval(ts: number, ask: NotificationAsk, text: string): Promise<AskHandleResult> {
		this.outputManager.output(`\n[${ask}]`)
		if (text) {
			this.outputManager.output(`  ${text}`)
		}
		this.outputManager.markDisplayed(ts, text || "", false)
		if (this.nonInteractive) {
			return { handled: true }
		}
		return await this.promptApproval("Approve? (y/n): ")
	}
}
