import crypto from "crypto"

import { getTelemetryService } from "@jabberwock/telemetry"

import type { ApiHandler, ApiHandlerCreateMessageMetadata } from "@api"
import {
	MAX_CONDENSE_THRESHOLD,
	MIN_CONDENSE_THRESHOLD,
} from "@features/chat/task/condense/handlers/on-context-condense-utils"
import { summarizeConversation } from "@features/chat/task/condense/handlers/on-context-condense"
import type { SummarizeResponse } from "@features/chat/task/condense/handlers/on-context-condense-types"
import type { ApiMessage } from "@features/chat/task/messages/actions/save/saveApiMessages.types"

import { diagnosticsManager } from "@jabberwock/devtool"
import { t } from "@i18n"

import { type ContextManagementResult, type TruncationResult } from "./utils/context-management.types"

/**
 * Default percentage of the context window to use as a buffer when deciding when to truncate.
 */
export const TOKEN_BUFFER_PERCENTAGE = 0.1

/**
 * Counts tokens for user content using the provider's token counting implementation.
 */
export async function estimateTokenCount(
	content: Array<import("@anthropic-ai/sdk").Anthropic.Messages.ContentBlockParam>,
	apiHandler: ApiHandler,
): Promise<number> {
	if (!content || content.length === 0) return 0
	return apiHandler.countTokens(content)
}

/**
 * Truncates a conversation by tagging messages as hidden instead of removing them.
 */
export function truncateConversation(messages: ApiMessage[], fracToRemove: number, taskId: string): TruncationResult {
	getTelemetryService().captureSlidingWindowTruncation(taskId)

	const truncationId = crypto.randomUUID()

	const visibleIndices: number[] = []
	messages.forEach((msg, index) => {
		if (!msg.truncationParent && !msg.isTruncationMarker) {
			visibleIndices.push(index)
		}
	})

	const visibleCount = visibleIndices.length
	const rawMessagesToRemove = Math.floor((visibleCount - 1) * fracToRemove)
	const messagesToRemove = rawMessagesToRemove - (rawMessagesToRemove % 2)

	if (messagesToRemove <= 0) {
		return {
			messages,
			truncationId,
			messagesRemoved: 0,
		}
	}

	const indicesToTruncate = new Set(visibleIndices.slice(1, messagesToRemove + 1))

	const taggedMessages = messages.map((msg, index) => {
		if (indicesToTruncate.has(index)) {
			return { ...msg, truncationParent: truncationId }
		}
		return msg
	})

	const firstKeptVisibleIndex = visibleIndices[messagesToRemove + 1] ?? taggedMessages.length

	const firstKeptTs = messages[firstKeptVisibleIndex]?.ts ?? Date.now()
	const truncationMarker: ApiMessage = {
		role: "user",
		content: `[Sliding window truncation: ${messagesToRemove} messages hidden to reduce context]`,
		ts: firstKeptTs - 1,
		isTruncationMarker: true,
		truncationId,
	}

	const insertPosition = firstKeptVisibleIndex
	const result = [
		...taggedMessages.slice(0, insertPosition),
		truncationMarker,
		...taggedMessages.slice(insertPosition),
	]

	return {
		messages: result,
		truncationId,
		messagesRemoved: messagesToRemove,
	}
}

export function resolveEffectiveThreshold(
	autoCondenseContextPercent: number,
	profileThresholds: Record<string, number>,
	currentProfileId: string,
): number {
	const profileThreshold = profileThresholds[currentProfileId]
	if (profileThreshold === undefined) {
		return autoCondenseContextPercent
	}

	if (profileThreshold === -1) {
		return autoCondenseContextPercent
	}

	if (profileThreshold >= MIN_CONDENSE_THRESHOLD && profileThreshold <= MAX_CONDENSE_THRESHOLD) {
		return profileThreshold
	}

	console.warn(
		`[jabberwock] Invalid profile threshold ${profileThreshold} for profile "${currentProfileId}". Using global default of ${autoCondenseContextPercent}%`,
	)
	return autoCondenseContextPercent
}

export async function condenseOrFallback(
	messages: ApiMessage[],
	apiHandler: ApiHandler,
	systemPrompt: string,
	taskId: string,
	customCondensingPrompt: string | undefined,
	metadata: ApiHandlerCreateMessageMetadata | undefined,
	environmentDetails: string | undefined,
	filesReadByJabberwock: string[] | undefined,
	cwd: string | undefined,
	jabberwockIgnoreController: string | undefined,
	prevContextTokens: number,
	allowedTokens: number,
): Promise<ContextManagementResult> {
	diagnosticsManager.setCurrentAction(t("diagnostics:actions.contextCondense"))
	const condenseStartTime = Date.now()

	const result = await summarizeConversation({
		messages,
		apiHandler,
		systemPrompt,
		taskId,
		isAutomaticTrigger: true,
		customCondensingPrompt,
		metadata,
		environmentDetails,
		filesReadByJabberwock,
		cwd,
		jabberwockIgnoreController,
	})

	if (result.error) {
		return handleCondenseError(result, prevContextTokens, allowedTokens, messages, systemPrompt, apiHandler, taskId)
	}

	diagnosticsManager.recordMetric("Context Condensation", Date.now() - condenseStartTime, "success")
	return { ...result, prevContextTokens }
}

async function handleCondenseError(
	result: SummarizeResponse,
	prevContextTokens: number,
	allowedTokens: number,
	messages: ApiMessage[],
	systemPrompt: string,
	apiHandler: ApiHandler,
	taskId: string,
): Promise<ContextManagementResult> {
	if (prevContextTokens > allowedTokens) {
		return truncateAndReturn(
			messages,
			systemPrompt,
			apiHandler,
			taskId,
			prevContextTokens,
			result.cost,
			result.error,
			result.errorDetails,
		)
	}
	return {
		messages,
		summary: "",
		cost: result.cost,
		prevContextTokens,
		error: result.error,
		errorDetails: result.errorDetails,
	}
}

export async function truncateAndReturn(
	messages: ApiMessage[],
	systemPrompt: string,
	apiHandler: ApiHandler,
	taskId: string,
	prevContextTokens: number,
	cost: number,
	error: string | undefined,
	errorDetails: string | undefined,
): Promise<ContextManagementResult> {
	const truncationResult = truncateConversation(messages, 0.5, taskId)

	const effectiveMessages = truncationResult.messages.filter(
		(msg) => !msg.truncationParent && !msg.isTruncationMarker,
	)

	let newContextTokensAfterTruncation = await estimateTokenCount([{ type: "text", text: systemPrompt }], apiHandler)

	for (const msg of effectiveMessages) {
		const content = msg.content
		if (Array.isArray(content)) {
			newContextTokensAfterTruncation += await estimateTokenCount(content, apiHandler)
		} else if (typeof content === "string") {
			newContextTokensAfterTruncation += await estimateTokenCount([{ type: "text", text: content }], apiHandler)
		}
	}

	return {
		messages: truncationResult.messages,
		prevContextTokens,
		summary: "",
		cost,
		error,
		errorDetails,
		truncationId: truncationResult.truncationId,
		messagesRemoved: truncationResult.messagesRemoved,
		newContextTokensAfterTruncation,
	}
}
