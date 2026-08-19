import { Anthropic } from "@anthropic-ai/sdk"
import { getTelemetryService, hasTelemetryService } from "@jabberwock/telemetry"
import { findLastIndex } from "@shared/array"

/**
 * Custom error class for tool result ID mismatches.
 * Used for structured error tracking via PostHog.
 */
export class ToolResultIdMismatchError extends Error {
	constructor(
		message: string,
		public readonly toolResultIds: string[],
		public readonly toolUseIds: string[],
	) {
		super(message)
		this.name = "ToolResultIdMismatchError"
	}
}

/**
 * Custom error class for missing tool results.
 * Used for structured error tracking via PostHog when tool_use blocks
 * don't have corresponding tool_result blocks.
 */
export class MissingToolResultError extends Error {
	constructor(
		message: string,
		public readonly missingToolUseIds: string[],
		public readonly existingToolResultIds: string[],
	) {
		super(message)
		this.name = "MissingToolResultError"
	}
}

/**
 * Validates and fixes tool_result IDs in a user message against the previous assistant message.
 *
 * This is a centralized validation that catches all tool_use/tool_result issues
 * before messages are added to the API conversation history. It handles scenarios like:
 * - Race conditions during streaming
 * - Message editing scenarios
 * - Resume/delegation scenarios
 * - Missing tool_result blocks for tool_use calls
 *
 * @param userMessage - The user message being added to history
 * @param apiConversationHistory - The conversation history to find the previous assistant message from
 * @returns The validated user message with corrected tool_use_ids and any missing tool_results added
 */
function deduplicateToolResults(userMessage: Anthropic.MessageParam): Anthropic.MessageParam {
	const seenToolResultIds = new Set<string>()
	const deduplicatedContent = (userMessage.content as Anthropic.Messages.ContentBlockParam[]).filter((block) => {
		if (block.type !== "tool_result") {
			return true
		}
		if (seenToolResultIds.has(block.tool_use_id)) {
			return false
		}
		seenToolResultIds.add(block.tool_use_id)
		return true
	})
	return {
		...userMessage,
		content: deduplicatedContent,
	}
}

function reportTelemetryIssues(
	missingToolUseIds: string[],
	toolResults: Anthropic.ToolResultBlockParam[],
	toolUseBlocks: Anthropic.ToolUseBlock[],
	hasInvalidIds: boolean,
): void {
	const toolResultIdList = toolResults.map((r) => r.tool_use_id)
	const toolUseIdList = toolUseBlocks.map((b) => b.id)

	if (missingToolUseIds.length > 0 && hasTelemetryService()) {
		getTelemetryService().captureException(
			new MissingToolResultError(
				`Detected missing tool_result blocks. Missing tool_use IDs: [${missingToolUseIds.join(", ")}], existing tool_result IDs: [${toolResultIdList.join(", ")}]`,
				missingToolUseIds,
				toolResultIdList,
			),
			{
				missingToolUseIds,
				existingToolResultIds: toolResultIdList,
				toolUseCount: toolUseBlocks.length,
				toolResultCount: toolResults.length,
			},
		)
	}

	if (hasInvalidIds && hasTelemetryService()) {
		getTelemetryService().captureException(
			new ToolResultIdMismatchError(
				`Detected tool_result ID mismatch. tool_result IDs: [${toolResultIdList.join(", ")}], tool_use IDs: [${toolUseIdList.join(", ")}]`,
				toolResultIdList,
				toolUseIdList,
			),
			{
				toolResultIds: toolResultIdList,
				toolUseIds: toolUseIdList,
				toolResultCount: toolResults.length,
				toolUseCount: toolUseBlocks.length,
			},
		)
	}
}

function buildCorrectedContent(
	userMessage: Anthropic.MessageParam,
	toolResults: Anthropic.ToolResultBlockParam[],
	toolUseBlocks: Anthropic.ToolUseBlock[],
	validToolUseIds: Set<string>,
): Anthropic.Messages.ContentBlockParam[] {
	const usedToolUseIds = new Set<string>()
	const contentArray = userMessage.content as Anthropic.Messages.ContentBlockParam[]

	return contentArray
		.map((block: Anthropic.Messages.ContentBlockParam) => {
			if (block.type !== "tool_result") {
				return block
			}

			if (validToolUseIds.has(block.tool_use_id) && !usedToolUseIds.has(block.tool_use_id)) {
				usedToolUseIds.add(block.tool_use_id)
				return block
			}

			const toolResultIndex = toolResults.indexOf(block as Anthropic.ToolResultBlockParam)

			if (toolResultIndex !== -1 && toolResultIndex < toolUseBlocks.length) {
				const correctId = toolUseBlocks[toolResultIndex].id
				if (!usedToolUseIds.has(correctId)) {
					usedToolUseIds.add(correctId)
					return {
						...block,
						tool_use_id: correctId,
					}
				}
			}

			return null
		})
		.filter((block): block is NonNullable<typeof block> => block !== null)
}

export function validateAndFixToolResultIds(
	userMessage: Anthropic.MessageParam,
	apiConversationHistory: Anthropic.MessageParam[],
): Anthropic.MessageParam {
	if (userMessage.role !== "user" || !Array.isArray(userMessage.content)) {
		return userMessage
	}

	const prevAssistantIdx = findLastIndex(apiConversationHistory, (msg) => msg.role === "assistant")
	if (prevAssistantIdx === -1) {
		return userMessage
	}

	const previousAssistantMessage = apiConversationHistory[prevAssistantIdx]
	const assistantContent = previousAssistantMessage.content
	if (!Array.isArray(assistantContent)) {
		return userMessage
	}

	const toolUseBlocks = assistantContent.filter((block): block is Anthropic.ToolUseBlock => block.type === "tool_use")
	if (toolUseBlocks.length === 0) {
		return userMessage
	}

	const validToolUseIds = new Set(toolUseBlocks.map((block) => block.id))

	userMessage = deduplicateToolResults(userMessage)
	const toolResults = (userMessage.content as Anthropic.Messages.ContentBlockParam[]).filter(
		(block): block is Anthropic.ToolResultBlockParam => block.type === "tool_result",
	)

	const existingToolResultIds = new Set(toolResults.map((r) => r.tool_use_id))
	const missingToolUseIds = toolUseBlocks
		.filter((toolUse) => !existingToolResultIds.has(toolUse.id))
		.map((toolUse) => toolUse.id)
	const hasInvalidIds = toolResults.some((result) => !validToolUseIds.has(result.tool_use_id))

	if (missingToolUseIds.length === 0 && !hasInvalidIds) {
		return userMessage
	}

	reportTelemetryIssues(missingToolUseIds, toolResults, toolUseBlocks, hasInvalidIds)

	const correctedContent = buildCorrectedContent(userMessage, toolResults, toolUseBlocks, validToolUseIds)
	const stillMissingToolUseIds = toolUseBlocks.filter(
		(toolUse) => !correctedContent.some((b) => b.type === "tool_result" && b.tool_use_id === toolUse.id),
	)

	const missingToolResults = stillMissingToolUseIds.map((toolUse) => ({
		type: "tool_result" as const,
		tool_use_id: toolUse.id,
		content: "Tool execution was interrupted before completion.",
	}))

	const finalContent = missingToolResults.length > 0 ? [...missingToolResults, ...correctedContent] : correctedContent

	return {
		...userMessage,
		content: finalContent,
	}
}
