import { NotificationAsk, isIdleAsk, isInteractiveAsk, isResumableAsk, isNonBlockingAsk } from "@jabberwock/types"

import { FOLLOWUP_TIMEOUT_SECONDS } from "@/types/index.js"

import type { AskHandleResult, AskDispatcherOptions } from "./types.js"
import { safeJsonParse } from "./helpers.js"
import { createAskApprovalHandler, type AskApprovalHandler } from "./approval-handler.js"

export function createAskHandlerDelegator(options: AskDispatcherOptions) {
	const outputManager = options.outputManager
	const promptManager = options.promptManager
	const sendMessage = options.sendMessage
	const nonInteractive = options.nonInteractive ?? false
	const approvalHandler: AskApprovalHandler = createAskApprovalHandler({
		outputManager: options.outputManager,
		promptManager: options.promptManager,
		sendMessage: options.sendMessage,
		nonInteractive: options.nonInteractive ?? false,
		exitOnError: options.exitOnError ?? false,
	})

	function getAskHandler(
		ask: NotificationAsk,
	): ((ts: number, ask: NotificationAsk, text: string) => Promise<AskHandleResult>) | undefined {
		if (isNonBlockingAsk(ask)) {
			return handleNonBlockingAsk
		}
		if (isIdleAsk(ask)) {
			return handleIdleAsk
		}
		if (isResumableAsk(ask)) {
			return handleResumableAsk
		}
		if (isInteractiveAsk(ask)) {
			return handleInteractiveAsk
		}
		return undefined
	}

	async function handleUnknownAsk(ts: number, ask: NotificationAsk, text: string): Promise<AskHandleResult> {
		if (nonInteractive) {
			if (text) {
				outputManager.output(`\n[${ask}]`, text)
			}
			return { handled: true }
		}
		return await approvalHandler.handleGenericApproval(ts, ask, text)
	}

	async function handleNonBlockingAsk(_ts: number, _ask: NotificationAsk, _text: string): Promise<AskHandleResult> {
		sendApprovalResponse(true)
		return { handled: true, response: "yesButtonClicked" }
	}

	async function handleIdleAsk(ts: number, ask: NotificationAsk, text: string): Promise<AskHandleResult> {
		switch (ask) {
			case "completion_result":
				return { handled: true }
			case "api_req_failed":
				return await approvalHandler.handleApiFailedRetry(ts, text)
			case "mistake_limit_reached":
				return await approvalHandler.handleMistakeLimitReached(ts, text)
			case "resume_completed_task":
				return await approvalHandler.handleResumeTask(ts, ask, text)
			case "auto_approval_max_req_reached":
				return await approvalHandler.handleAutoApprovalMaxReached(ts, text)
			default:
				return { handled: false }
		}
	}

	async function handleResumableAsk(ts: number, ask: NotificationAsk, text: string): Promise<AskHandleResult> {
		return await approvalHandler.handleResumeTask(ts, ask, text)
	}

	async function handleInteractiveAsk(ts: number, ask: NotificationAsk, text: string): Promise<AskHandleResult> {
		switch (ask) {
			case "followup":
				return await handleFollowupQuestion(ts, text)
			case "command":
				return await approvalHandler.handleCommandApproval(ts, text)
			case "tool":
				return await approvalHandler.handleToolApproval(ts, text)
			case "use_mcp_server":
				return await approvalHandler.handleMcpApproval(ts, text)
			default:
				return { handled: false }
		}
	}

	async function handleNonInteractiveFollowup(
		suggestions: Array<{ answer: string; mode?: string | null }>,
		defaultAnswer: string,
	): Promise<AskHandleResult> {
		const timeoutMs = FOLLOWUP_TIMEOUT_SECONDS * 1000
		const result = await promptManager.promptWithTimeout(
			suggestions.length > 0
				? `Enter number (1-${suggestions.length}) or type your answer (auto-select in ${Math.round(timeoutMs / 1000)}s): `
				: `Your answer (auto-select in ${Math.round(timeoutMs / 1000)}s): `,
			timeoutMs,
			defaultAnswer,
		)
		const responseText = resolveNumberedSuggestion(result.value.trim(), suggestions)
		if (result.timedOut || result.cancelled) {
			outputManager.output(`[Using default: ${defaultAnswer || "(empty)"}]`)
		}
		sendFollowupResponse(responseText)
		return { handled: true, response: "messageResponse" }
	}

	async function handleFollowupQuestion(ts: number, text: string): Promise<AskHandleResult> {
		const data = safeJsonParse<{ question?: string; suggest?: Array<{ answer: string; mode?: string | null }> }>(
			text,
			{},
		)
		const question = data.question || text
		const suggestions = Array.isArray(data.suggest) ? data.suggest : []
		outputManager.output("\n[question]", question)
		displaySuggestions(suggestions)
		const defaultAnswer = suggestions.length > 0 ? (suggestions[0]?.answer ?? "") : ""
		if (nonInteractive) {
			return await handleNonInteractiveFollowup(suggestions, defaultAnswer)
		}
		try {
			const answer = await promptManager.promptForInput(
				suggestions.length > 0
					? `Enter number (1-${suggestions.length}) or type your answer: `
					: "Your answer: ",
			)
			sendFollowupResponse(resolveNumberedSuggestion(answer.trim(), suggestions))
			return { handled: true, response: "messageResponse" }
		} catch {
			outputManager.output(`[Using default: ${defaultAnswer || "(empty)"}]`)
			sendFollowupResponse(defaultAnswer)
			return { handled: true, response: "messageResponse" }
		}
	}

	function displaySuggestions(suggestions: Array<{ answer: string; mode?: string | null }>): void {
		if (suggestions.length === 0) {
			return
		}
		outputManager.output("\nSuggested answers:")
		suggestions.forEach((s, i) =>
			outputManager.output(`  ${i + 1}. ${s.answer || String(s)}${s.mode ? ` (mode: ${s.mode})` : ""}`),
		)
		outputManager.output("")
	}

	function sendFollowupResponse(text: string): void {
		sendMessage({ type: "askResponse", askResponse: "messageResponse", text })
	}

	function sendApprovalResponse(approved: boolean): void {
		sendMessage({ type: "askResponse", askResponse: approved ? "yesButtonClicked" : "noButtonClicked" })
	}

	function resolveNumberedSuggestion(
		input: string,
		suggestions: Array<{ answer: string; mode?: string | null }>,
	): string {
		const num = parseInt(input, 10)
		if (!isNaN(num) && num >= 1 && num <= suggestions.length) {
			const selected = suggestions[num - 1]
			if (selected) {
				const answer = selected.answer || String(selected)
				outputManager.output(`Selected: ${answer}`)
				return answer
			}
		}
		return input
	}

	return { getAskHandler, handleUnknownAsk }
}

/** AskHandlerDelegator instance type */
export type AskHandlerDelegator = ReturnType<typeof createAskHandlerDelegator>
