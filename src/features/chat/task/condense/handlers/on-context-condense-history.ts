import Anthropic from "@anthropic-ai/sdk"

import type { ApiMessage } from "@features/chat/task/messages/actions/save/saveApiMessages.types"
import { findLast } from "@shared/array"

export function getMessagesSinceLastSummary(messages: ApiMessage[]): ApiMessage[] {
	const lastSummaryIndexReverse = [...messages].reverse().findIndex((message) => message.isSummary)

	if (lastSummaryIndexReverse === -1) {
		return messages
	}

	const lastSummaryIndex = messages.length - lastSummaryIndexReverse - 1
	return messages.slice(lastSummaryIndex)
}

function collectToolUseIds(messages: ApiMessage[]): Set<string> {
	const toolUseIds = new Set<string>()
	for (const msg of messages) {
		if (msg.role === "assistant" && Array.isArray(msg.content)) {
			for (const block of msg.content) {
				if (block.type === "tool_use") {
					const toolUseBlock = block as Anthropic.Messages.ToolUseBlockParam
					if (toolUseBlock.id) {
						toolUseIds.add(toolUseBlock.id)
					}
				}
			}
		}
	}
	return toolUseIds
}

function filterOrphanToolResults(msg: ApiMessage, toolUseIds: Set<string>): ApiMessage | null {
	if (msg.role !== "user" || !Array.isArray(msg.content)) {
		return msg
	}

	const filteredContent = msg.content.filter((block) => {
		if (block.type === "tool_result") {
			const toolResultBlock = block as Anthropic.Messages.ToolResultBlockParam
			return toolUseIds.has(toolResultBlock.tool_use_id)
		}
		return true
	})

	if (filteredContent.length === 0) {
		return null
	}

	if (filteredContent.length !== msg.content.length) {
		return { ...msg, content: filteredContent }
	}

	return msg
}

function collectExistingParentIds(messages: ApiMessage[]): {
	summaryIds: Set<string>
	truncationIds: Set<string>
} {
	const summaryIds = new Set<string>()
	const truncationIds = new Set<string>()

	for (const msg of messages) {
		if (msg.isSummary && msg.condenseId) {
			summaryIds.add(msg.condenseId)
		}
		if (msg.isTruncationMarker && msg.truncationId) {
			truncationIds.add(msg.truncationId)
		}
	}

	return { summaryIds, truncationIds }
}

export function getEffectiveApiHistory(messages: ApiMessage[]): ApiMessage[] {
	const lastSummary = findLast(messages, (msg) => msg.isSummary === true)

	if (lastSummary) {
		const summaryIndex = messages.indexOf(lastSummary)
		let messagesFromSummary = messages.slice(summaryIndex)

		const toolUseIds = collectToolUseIds(messagesFromSummary)

		messagesFromSummary = messagesFromSummary
			.map((msg) => filterOrphanToolResults(msg, toolUseIds))
			.filter((msg): msg is ApiMessage => msg !== null)

		const existingTruncationIds = new Set<string>()
		for (const msg of messagesFromSummary) {
			if (msg.isTruncationMarker && msg.truncationId) {
				existingTruncationIds.add(msg.truncationId)
			}
		}

		return messagesFromSummary.filter((msg) => {
			if (msg.truncationParent && existingTruncationIds.has(msg.truncationParent)) {
				return false
			}
			return true
		})
	}

	const { summaryIds, truncationIds } = collectExistingParentIds(messages)

	return messages.filter((msg) => {
		if (msg.condenseParent && summaryIds.has(msg.condenseParent)) {
			return false
		}
		if (msg.truncationParent && truncationIds.has(msg.truncationParent)) {
			return false
		}
		return true
	})
}

export function cleanupAfterTruncation(messages: ApiMessage[]): ApiMessage[] {
	const existingSummaryIds = new Set<string>()
	const existingTruncationIds = new Set<string>()

	for (const msg of messages) {
		if (msg.isSummary && msg.condenseId) {
			existingSummaryIds.add(msg.condenseId)
		}
		if (msg.isTruncationMarker && msg.truncationId) {
			existingTruncationIds.add(msg.truncationId)
		}
	}

	return messages.map((msg) => {
		let needsUpdate = false

		if (msg.condenseParent && !existingSummaryIds.has(msg.condenseParent)) {
			needsUpdate = true
		}

		if (msg.truncationParent && !existingTruncationIds.has(msg.truncationParent)) {
			needsUpdate = true
		}

		if (needsUpdate) {
			const { condenseParent, truncationParent, ...rest } = msg
			const result: ApiMessage = rest as ApiMessage

			if (condenseParent && existingSummaryIds.has(condenseParent)) {
				result.condenseParent = condenseParent
			}

			if (truncationParent && existingTruncationIds.has(truncationParent)) {
				result.truncationParent = truncationParent
			}

			return result
		}
		return msg
	})
}
