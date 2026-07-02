import Anthropic from "@anthropic-ai/sdk"

import type { ApiHandler, ApiHandlerCreateMessageMetadata } from "@api"
import type { ApiMessage } from "@features/chat/task/messages/actions/save/saveApiMessages.types"
import { maybeRemoveImageBlocks } from "@api/transform/content/image-cleaning"
import { supportPrompt } from "@shared/support-prompt"
import { t } from "@i18n"

import { injectSyntheticToolResults, transformMessagesForCondensing } from "./on-context-condense-utils"

export function buildErrorDetails(error: unknown): string {
	if (!(error instanceof Error)) {
		return String(error)
	}

	const anyError = error as Error & { status?: unknown; code?: unknown; response?: unknown; body?: unknown }
	let details = `Error: ${error.message}`

	if (anyError.status) {
		details += `\n\nHTTP Status: ${anyError.status}`
	}
	if (anyError.code) {
		details += `\nError Code: ${anyError.code}`
	}
	if (anyError.response) {
		try {
			details += `\n\nAPI Response:\n${JSON.stringify(anyError.response, null, 2)}`
		} catch {
			details += `\n\nAPI Response: [Unable to serialize]`
		}
	}
	if (anyError.body) {
		try {
			details += `\n\nResponse Body:\n${JSON.stringify(anyError.body, null, 2)}`
		} catch {
			details += `\n\nResponse Body: [Unable to serialize]`
		}
	}

	return details
}

export function buildSummaryContentBlocks(
	summary: string,
	commandBlocks: string,
	isAutomaticTrigger?: boolean,
	environmentDetails?: string,
): Anthropic.Messages.ContentBlockParam[] {
	const summaryContent: Anthropic.Messages.ContentBlockParam[] = [
		{ type: "text", text: `## Conversation Summary\n${summary}` },
	]

	if (commandBlocks) {
		summaryContent.push({
			type: "text",
			text: `<system-reminder>
## Active Workflows
The following directives must be maintained across all future condensings:
${commandBlocks}
</system-reminder>`,
		})
	}

	if (isAutomaticTrigger && environmentDetails?.trim()) {
		summaryContent.push({
			type: "text",
			text: environmentDetails,
		})
	}

	return summaryContent
}

export async function computeSummaryContextTokens(
	apiHandler: ApiHandler,
	systemPrompt: string,
	summaryMessage: ApiMessage,
	metadata?: ApiHandlerCreateMessageMetadata,
): Promise<number> {
	const systemPromptMessage: ApiMessage = { role: "user", content: systemPrompt }

	const contextBlocks = [systemPromptMessage, summaryMessage].flatMap((message) =>
		typeof message.content === "string" ? [{ text: message.content, type: "text" as const }] : message.content,
	)

	const messageTokens = await apiHandler.countTokens(contextBlocks)

	let toolTokens = 0
	if (metadata?.tools && metadata.tools.length > 0) {
		const toolsText = JSON.stringify(metadata.tools)
		toolTokens = await apiHandler.countTokens([{ text: toolsText, type: "text" }])
	}

	return messageTokens + toolTokens
}

export function getCondenseEligibilityError(
	messages: ApiMessage[],
	messagesToSummarize: ApiMessage[],
): string | undefined {
	if (messagesToSummarize.length <= 1) {
		return messages.length <= 1
			? t("common:errors.condense_not_enough_messages")
			: t("common:errors.condensed_recently")
	}

	const recentSummaryExists = messagesToSummarize.some((message: ApiMessage) => message.isSummary)
	if (recentSummaryExists && messagesToSummarize.length <= 2) {
		return t("common:errors.condensed_recently")
	}

	return undefined
}

export async function executeCondenseApiCall(
	apiHandler: ApiHandler,
	promptToUse: string,
	requestMessages: Anthropic.MessageParam[],
	metadata: ApiHandlerCreateMessageMetadata | undefined,
): Promise<{ summary: string; cost: number; error?: string; errorDetails?: string }> {
	let summary = ""
	let cost = 0

	try {
		const stream = apiHandler.createMessage(promptToUse, requestMessages, metadata)

		for await (const chunk of stream) {
			if (chunk.type === "text") {
				summary += chunk.text
			} else if (chunk.type === "usage") {
				cost = chunk.totalCost ?? 0
			}
		}
	} catch (error) {
		console.error("[jabberwock] Error during condensing API call:", error)
		const errorMessage = error instanceof Error ? error.message : String(error)
		const errorDetails = buildErrorDetails(error)

		return { summary, cost, error: t("common:errors.condense_api_failed", { message: errorMessage }), errorDetails }
	}

	return { summary: summary.trim(), cost }
}

export function prepareCondenseRequest(
	messagesToSummarize: ApiMessage[],
	customCondensingPrompt: string | undefined,
	apiHandler: ApiHandler,
): Anthropic.MessageParam[] {
	const condenseInstructions = customCondensingPrompt?.trim() || supportPrompt.default.CONDENSE

	const finalRequestMessage: Anthropic.MessageParam = { role: "user", content: condenseInstructions }

	const messagesWithToolResults = injectSyntheticToolResults(messagesToSummarize)

	const messagesWithTextToolBlocks = transformMessagesForCondensing(
		maybeRemoveImageBlocks([...messagesWithToolResults, finalRequestMessage], apiHandler),
	)

	return messagesWithTextToolBlocks.map(({ role, content }) => ({ role, content }))
}

export function validateApiHandler(apiHandler: ApiHandler): string | undefined {
	if (!apiHandler || typeof apiHandler.createMessage !== "function") {
		console.error("[jabberwock] API handler is invalid for condensing. Cannot proceed.")
		return t("common:errors.condense_handler_invalid")
	}
	return undefined
}
