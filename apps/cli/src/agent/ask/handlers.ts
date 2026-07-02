import { NotificationAsk, isIdleAsk, isInteractiveAsk, isResumableAsk, isNonBlockingAsk } from "@jabberwock/types"

import { FOLLOWUP_TIMEOUT_SECONDS } from "@/types/index.js"

import type { OutputManager } from "../output/manager.js"
import type { PromptManager } from "../prompt-manager/prompt-manager.js"
import type { WebviewMessage } from "@jabberwock/types"
import type { AskHandleResult, AskDispatcherOptions } from "./dispatcher-types.js"
import { safeJsonParse } from "./dispatcher-utils.js"
import { AskApprovalHandler } from "./approval-handlers.js"

export class AskHandlerDelegator {
	private approvalHandler: AskApprovalHandler
	private outputManager: OutputManager
	private promptManager: PromptManager
	private sendMessage: (message: WebviewMessage) => void
	private nonInteractive: boolean
	private handledAsks: Set<number>

	constructor(options: AskDispatcherOptions, handledAsks: Set<number>) {
		this.outputManager = options.outputManager
		this.promptManager = options.promptManager
		this.sendMessage = options.sendMessage
		this.nonInteractive = options.nonInteractive ?? false
		this.handledAsks = handledAsks
		this.approvalHandler = new AskApprovalHandler({
			outputManager: options.outputManager,
			promptManager: options.promptManager,
			sendMessage: options.sendMessage,
			nonInteractive: options.nonInteractive ?? false,
			exitOnError: options.exitOnError ?? false,
		})
	}

	getAskHandler(
		ask: NotificationAsk,
	): ((ts: number, ask: NotificationAsk, text: string) => Promise<AskHandleResult>) | undefined {
		if (isNonBlockingAsk(ask)) {
			return this.handleNonBlockingAsk.bind(this)
		}
		if (isIdleAsk(ask)) {
			return this.handleIdleAsk.bind(this)
		}
		if (isResumableAsk(ask)) {
			return this.handleResumableAsk.bind(this)
		}
		if (isInteractiveAsk(ask)) {
			return this.handleInteractiveAsk.bind(this)
		}
		return undefined
	}

	async handleUnknownAsk(ts: number, ask: NotificationAsk, text: string): Promise<AskHandleResult> {
		if (this.nonInteractive) {
			if (text) {
				this.outputManager.output(`\n[${ask}]`, text)
			}
			return { handled: true }
		}
		return await this.approvalHandler.handleGenericApproval(ts, ask, text)
	}

	private async handleNonBlockingAsk(_ts: number, _ask: NotificationAsk, _text: string): Promise<AskHandleResult> {
		this.sendApprovalResponse(true)
		return { handled: true, response: "yesButtonClicked" }
	}

	private async handleIdleAsk(ts: number, ask: NotificationAsk, text: string): Promise<AskHandleResult> {
		switch (ask) {
			case "completion_result":
				return { handled: true }
			case "api_req_failed":
				return await this.approvalHandler.handleApiFailedRetry(ts, text)
			case "mistake_limit_reached":
				return await this.approvalHandler.handleMistakeLimitReached(ts, text)
			case "resume_completed_task":
				return await this.approvalHandler.handleResumeTask(ts, ask, text)
			case "auto_approval_max_req_reached":
				return await this.approvalHandler.handleAutoApprovalMaxReached(ts, text)
			default:
				return { handled: false }
		}
	}

	private async handleResumableAsk(ts: number, ask: NotificationAsk, text: string): Promise<AskHandleResult> {
		return await this.approvalHandler.handleResumeTask(ts, ask, text)
	}

	private async handleInteractiveAsk(ts: number, ask: NotificationAsk, text: string): Promise<AskHandleResult> {
		switch (ask) {
			case "followup":
				return await this.handleFollowupQuestion(ts, text)
			case "command":
				return await this.approvalHandler.handleCommandApproval(ts, text)
			case "tool":
				return await this.approvalHandler.handleToolApproval(ts, text)
			case "use_mcp_server":
				return await this.approvalHandler.handleMcpApproval(ts, text)
			default:
				return { handled: false }
		}
	}

	private async handleNonInteractiveFollowup(
		suggestions: Array<{ answer: string; mode?: string | null }>,
		defaultAnswer: string,
	): Promise<AskHandleResult> {
		const timeoutMs = FOLLOWUP_TIMEOUT_SECONDS * 1000
		const result = await this.promptManager.promptWithTimeout(
			suggestions.length > 0
				? `Enter number (1-${suggestions.length}) or type your answer (auto-select in ${Math.round(timeoutMs / 1000)}s): `
				: `Your answer (auto-select in ${Math.round(timeoutMs / 1000)}s): `,
			timeoutMs,
			defaultAnswer,
		)
		const responseText = this.resolveNumberedSuggestion(result.value.trim(), suggestions)
		if (result.timedOut || result.cancelled) {
			this.outputManager.output(`[Using default: ${defaultAnswer || "(empty)"}]`)
		}
		this.sendFollowupResponse(responseText)
		return { handled: true, response: "messageResponse" }
	}

	private async handleFollowupQuestion(ts: number, text: string): Promise<AskHandleResult> {
		const data = safeJsonParse<{ question?: string; suggest?: Array<{ answer: string; mode?: string | null }> }>(
			text,
			{},
		)
		const question = data.question || text
		const suggestions = Array.isArray(data.suggest) ? data.suggest : []
		this.outputManager.output("\n[question]", question)
		this.displaySuggestions(suggestions)
		const defaultAnswer = suggestions.length > 0 ? (suggestions[0]?.answer ?? "") : ""
		if (this.nonInteractive) {
			return await this.handleNonInteractiveFollowup(suggestions, defaultAnswer)
		}
		try {
			const answer = await this.promptManager.promptForInput(
				suggestions.length > 0
					? `Enter number (1-${suggestions.length}) or type your answer: `
					: "Your answer: ",
			)
			this.sendFollowupResponse(this.resolveNumberedSuggestion(answer.trim(), suggestions))
			return { handled: true, response: "messageResponse" }
		} catch {
			this.outputManager.output(`[Using default: ${defaultAnswer || "(empty)"}]`)
			this.sendFollowupResponse(defaultAnswer)
			return { handled: true, response: "messageResponse" }
		}
	}

	private displaySuggestions(suggestions: Array<{ answer: string; mode?: string | null }>): void {
		if (suggestions.length === 0) {
			return
		}
		this.outputManager.output("\nSuggested answers:")
		suggestions.forEach((s, i) =>
			this.outputManager.output(`  ${i + 1}. ${s.answer || String(s)}${s.mode ? ` (mode: ${s.mode})` : ""}`),
		)
		this.outputManager.output("")
	}

	private sendFollowupResponse(text: string): void {
		this.sendMessage({ type: "askResponse", askResponse: "messageResponse", text })
	}

	private sendApprovalResponse(approved: boolean): void {
		this.sendMessage({ type: "askResponse", askResponse: approved ? "yesButtonClicked" : "noButtonClicked" })
	}

	private resolveNumberedSuggestion(
		input: string,
		suggestions: Array<{ answer: string; mode?: string | null }>,
	): string {
		const num = parseInt(input, 10)
		if (!isNaN(num) && num >= 1 && num <= suggestions.length) {
			const selected = suggestions[num - 1]
			if (selected) {
				const answer = selected.answer || String(selected)
				this.outputManager.output(`Selected: ${answer}`)
				return answer
			}
		}
		return input
	}
}
