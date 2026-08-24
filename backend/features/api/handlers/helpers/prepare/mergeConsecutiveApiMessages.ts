import { Anthropic } from "@anthropic-ai/sdk"

import type { ApiMessage } from "@features/chat/task/messages/actions/save/saveApiMessages.types"

type Role = ApiMessage["role"]

function normalizeContentToBlocks(content: ApiMessage["content"]): Anthropic.Messages.ContentBlockParam[] {
	if (Array.isArray(content)) {
		return content as Anthropic.Messages.ContentBlockParam[]
	}
	if (content === undefined || content === null) {
		return []
	}
	return [{ type: "text", text: String(content) }]
}

function canMergeMessages(prev: ApiMessage | undefined, msg: ApiMessage, mergeRoles: Set<Role>): boolean {
	return !!(
		prev &&
		prev.role === msg.role &&
		mergeRoles.has(msg.role) &&
		!msg.isSummary &&
		!prev.isTruncationMarker &&
		!msg.isTruncationMarker
	)
}

function mergeMessages(prev: ApiMessage, msg: ApiMessage): ApiMessage {
	const mergedContent = [...normalizeContentToBlocks(prev.content), ...normalizeContentToBlocks(msg.content)]

	return {
		...prev,
		content: mergedContent,
		ts: Math.max(prev.ts ?? 0, msg.ts ?? 0) || prev.ts || msg.ts,
	}
}

/**
 * Non-destructively merges consecutive messages with the same role.
 *
 * Used for *API request shaping only* (do not use for storage), so rewind/edit operations
 * can still reference the original individual messages.
 */
export function mergeConsecutiveApiMessages(messages: ApiMessage[], options?: { roles?: Role[] }): ApiMessage[] {
	if (messages.length <= 1) {
		return messages
	}

	const mergeRoles = new Set<Role>(options?.roles ?? ["user"])
	const out: ApiMessage[] = []

	for (const msg of messages) {
		const prev = out[out.length - 1]

		if (!canMergeMessages(prev, msg, mergeRoles)) {
			out.push(msg)
			continue
		}

		out[out.length - 1] = mergeMessages(prev, msg)
	}

	return out
}
