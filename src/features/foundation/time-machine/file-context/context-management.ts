import {
	MAX_CONDENSE_THRESHOLD,
	MIN_CONDENSE_THRESHOLD,
} from "@features/chat/task/condense/handlers/on-context-condense-utils"
import { ANTHROPIC_DEFAULT_MAX_TOKENS } from "@jabberwock/types"

import type {
	ContextManagementOptions,
	ContextManagementResult,
	WillManageContextOptions,
} from "./utils/context-management.types"
import {
	TOKEN_BUFFER_PERCENTAGE,
	estimateTokenCount,
	condenseOrFallback,
	resolveEffectiveThreshold,
	truncateAndReturn,
} from "./context-management.helpers"

/**
 * Checks whether context management (condensation or truncation) will likely run based on current token usage.
 *
 * This is useful for showing UI indicators before `manageContext` is actually called,
 * without duplicating the threshold calculation logic.
 *
 * @param {WillManageContextOptions} options - The options for threshold calculation
 * @returns {boolean} True if context management will likely run, false otherwise
 */
export function willManageContext({
	totalTokens,
	contextWindow,
	maxTokens,
	autoCondenseContext,
	autoCondenseContextPercent,
	profileThresholds,
	currentProfileId,
	lastMessageTokens,
}: WillManageContextOptions): boolean {
	if (!autoCondenseContext) {
		const reservedTokens = maxTokens || ANTHROPIC_DEFAULT_MAX_TOKENS
		const prevContextTokens = totalTokens + lastMessageTokens
		const allowedTokens = contextWindow * (1 - TOKEN_BUFFER_PERCENTAGE) - reservedTokens
		return prevContextTokens > allowedTokens
	}

	const reservedTokens = maxTokens || ANTHROPIC_DEFAULT_MAX_TOKENS
	const prevContextTokens = totalTokens + lastMessageTokens
	const allowedTokens = contextWindow * (1 - TOKEN_BUFFER_PERCENTAGE) - reservedTokens

	let effectiveThreshold = autoCondenseContextPercent
	const profileThreshold = profileThresholds[currentProfileId]
	if (profileThreshold !== undefined) {
		if (profileThreshold === -1) {
			effectiveThreshold = autoCondenseContextPercent
		} else if (profileThreshold >= MIN_CONDENSE_THRESHOLD && profileThreshold <= MAX_CONDENSE_THRESHOLD) {
			effectiveThreshold = profileThreshold
		}
	}

	const contextPercent = (100 * prevContextTokens) / contextWindow
	return contextPercent >= effectiveThreshold || prevContextTokens > allowedTokens
}

/**
 * Context Management: Conditionally manages the conversation context when approaching limits.
 *
 * Attempts intelligent condensation of prior messages when thresholds are reached.
 * Falls back to sliding window truncation if condensation is unavailable or fails.
 */
export async function manageContext({
	messages,
	totalTokens,
	contextWindow,
	maxTokens,
	apiHandler,
	autoCondenseContext,
	autoCondenseContextPercent,
	systemPrompt,
	taskId,
	customCondensingPrompt,
	profileThresholds,
	currentProfileId,
	metadata,
	environmentDetails,
	filesReadByJabberwock,
	cwd,
	jabberwockIgnoreController,
}: ContextManagementOptions): Promise<ContextManagementResult> {
	let error: string | undefined
	let errorDetails: string | undefined
	let cost = 0

	const reservedTokens = maxTokens || ANTHROPIC_DEFAULT_MAX_TOKENS

	const lastMessage = messages[messages.length - 1]
	const lastMessageContent = lastMessage.content
	const lastMessageTokens = Array.isArray(lastMessageContent)
		? await estimateTokenCount(lastMessageContent, apiHandler)
		: await estimateTokenCount([{ type: "text", text: lastMessageContent as string }], apiHandler)

	const prevContextTokens = totalTokens + lastMessageTokens

	const allowedTokens = contextWindow * (1 - TOKEN_BUFFER_PERCENTAGE) - reservedTokens

	const effectiveThreshold = resolveEffectiveThreshold(
		autoCondenseContextPercent,
		profileThresholds,
		currentProfileId,
	)

	if (autoCondenseContext) {
		const contextPercent = (100 * prevContextTokens) / contextWindow
		if (contextPercent >= effectiveThreshold || prevContextTokens > allowedTokens) {
			return condenseOrFallback(
				messages,
				apiHandler,
				systemPrompt,
				taskId,
				customCondensingPrompt,
				metadata,
				environmentDetails,
				filesReadByJabberwock,
				cwd,
				jabberwockIgnoreController,
				prevContextTokens,
				allowedTokens,
			)
		}
	}

	if (prevContextTokens > allowedTokens) {
		return truncateAndReturn(
			messages,
			systemPrompt,
			apiHandler,
			taskId,
			prevContextTokens,
			cost,
			error,
			errorDetails,
		)
	}

	return { messages, summary: "", cost, prevContextTokens, error, errorDetails }
}
