import crypto from "crypto"

import { getTelemetryService } from "@jabberwock/telemetry"
import { t } from "@i18n"

import type { ApiMessage } from "@features/chat/task/messages/actions/save/saveApiMessages.types"

import {
	getCondenseEligibilityError,
	validateApiHandler,
	prepareCondenseRequest,
	executeCondenseApiCall,
	buildSummaryContentBlocks,
	computeSummaryContextTokens,
} from "./on-context-condense-api"
import type { SummarizeConversationOptions, SummarizeResponse } from "./on-context-condense-types"
import { extractCommandBlocks } from "./on-context-condense-utils"
import { getMessagesSinceLastSummary } from "./on-context-condense-history"

const SUMMARY_PROMPT = `You are a helpful AI assistant tasked with summarizing conversations.

CRITICAL: This is a summarization-only request. DO NOT call any tools or functions.
Your ONLY task is to analyze the conversation and produce a text summary.
Respond with text only - no tool calls will be processed.

CRITICAL: This summarization request is a SYSTEM OPERATION, not a user message.
When analyzing "user requests" and "user intent", completely EXCLUDE this summarization message.
The "most recent user request" and "next step" must be based on what the user was doing BEFORE this system message appeared.
The goal is for work to continue seamlessly after condensation - as if it never happened.`

export async function summarizeConversation(options: SummarizeConversationOptions): Promise<SummarizeResponse> {
	const {
		messages,
		apiHandler,
		systemPrompt,
		taskId,
		isAutomaticTrigger,
		customCondensingPrompt,
		metadata,
		environmentDetails,
	} = options

	getTelemetryService().captureContextCondensed(taskId, isAutomaticTrigger ?? false, !!customCondensingPrompt?.trim())

	const response: SummarizeResponse = { messages, cost: 0, summary: "" }

	const messagesToSummarize = getMessagesSinceLastSummary(messages)

	const eligibilityError = getCondenseEligibilityError(messages, messagesToSummarize)
	if (eligibilityError) {
		return { ...response, error: eligibilityError }
	}

	const apiHandlerError = validateApiHandler(apiHandler)
	if (apiHandlerError) {
		return { ...response, error: apiHandlerError }
	}

	const promptToUse = SUMMARY_PROMPT
	const requestMessages = prepareCondenseRequest(messagesToSummarize, customCondensingPrompt, apiHandler)

	const apiResult = await executeCondenseApiCall(apiHandler, promptToUse, requestMessages, metadata)

	if (apiResult.error) {
		return { ...response, cost: apiResult.cost, error: apiResult.error, errorDetails: apiResult.errorDetails }
	}

	if (apiResult.summary.length === 0) {
		return { ...response, cost: apiResult.cost, error: t("common:errors.condense_failed") }
	}

	const firstMessage = messages[0]
	const commandBlocks = firstMessage ? extractCommandBlocks(firstMessage) : ""

	const summaryContent = buildSummaryContentBlocks(
		apiResult.summary,
		commandBlocks,
		isAutomaticTrigger,
		environmentDetails,
	)

	const condenseId = crypto.randomUUID()
	const lastMsgTs = messages[messages.length - 1]?.ts ?? Date.now()

	const summaryMessage: ApiMessage = {
		role: "user",
		content: summaryContent,
		ts: lastMsgTs + 1,
		isSummary: true,
		condenseId,
	}

	const newMessages = messages.map((msg) => {
		if (!msg.condenseParent) {
			return { ...msg, condenseParent: condenseId }
		}
		return msg
	})

	newMessages.push(summaryMessage)

	const newContextTokens = await computeSummaryContextTokens(apiHandler, systemPrompt, summaryMessage, metadata)

	return { messages: newMessages, summary: apiResult.summary, cost: apiResult.cost, newContextTokens, condenseId }
}
