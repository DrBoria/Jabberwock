import { safeWriteJson } from "../../../../../utils/safeWriteJson"
import type { ITaskModel } from "../../store"
import { postStateToWebview } from "../../../../foundation/window-manager/store"
import * as path from "path"
import * as fs from "fs/promises"

import { Anthropic } from "@anthropic-ai/sdk"

import { fileExistsAtPath } from "../../../../../utils/fs"

import { GlobalFileNames } from "../../../../../shared/globalFileNames"
import { getTaskDirectoryPath } from "../../../../../utils/storage"

export type ApiMessage = Anthropic.MessageParam & {
	ts?: number
	isSummary?: boolean
	id?: string
	// For reasoning items stored in API history
	type?: "reasoning"
	summary?: Anthropic.Messages.ContentBlockParam[]
	encrypted_content?: string
	text?: string
	// For OpenRouter reasoning_details array format (used by Gemini 3, etc.)
	reasoning_details?: { [key: string]: unknown }[]
	// For DeepSeek/Z.ai interleaved thinking: reasoning_content that must be preserved during tool call sequences
	// See: https://api-docs.deepseek.com/guides/thinking_mode#tool-calls
	reasoning_content?: string
	// For non-destructive condense: unique identifier for summary messages
	condenseId?: string
	// For non-destructive condense: points to the condenseId of the summary that replaces this message
	// Messages with condenseParent are filtered out when sending to API if the summary exists
	condenseParent?: string
	// For non-destructive truncation: unique identifier for truncation marker messages
	truncationId?: string
	// For non-destructive truncation: points to the truncationId of the marker that hides this message
	// Messages with truncationParent are filtered out when sending to API if the marker exists
	truncationParent?: string
	// Identifies a message as a truncation boundary marker
	isTruncationMarker?: boolean
}

export async function readApiConversation({
	taskId,
	globalStoragePath,
}: {
	taskId: string
	globalStoragePath: string
}): Promise<ApiMessage[]> {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filePath = path.join(taskDir, GlobalFileNames.apiConversationHistory)

	if (await fileExistsAtPath(filePath)) {
		const fileContent = await fs.readFile(filePath, "utf8")
		try {
			const parsedData = JSON.parse(fileContent)
			if (!Array.isArray(parsedData)) {
				console.warn(
					`[jabberwock] [readApiConversation] Parsed data is not an array (got ${typeof parsedData}), returning empty. TaskId: ${taskId}, Path: ${filePath}`,
				)
				return []
			}
			if (parsedData.length === 0) {
				console.error(
					`[jabberwock] [Jabberwock-Debug] readApiConversation: Found API conversation history file, but it's empty (parsed as []). TaskId: ${taskId}, Path: ${filePath}`,
				)
			}
			return parsedData
		} catch (error) {
			console.warn(
				`[jabberwock] [readApiConversation] Error parsing API conversation history file, returning empty. TaskId: ${taskId}, Path: ${filePath}, Error: ${error}`,
			)
			return []
		}
	} else {
		const oldPath = path.join(taskDir, "claude_messages.json")

		if (await fileExistsAtPath(oldPath)) {
			const fileContent = await fs.readFile(oldPath, "utf8")
			try {
				const parsedData = JSON.parse(fileContent)
				if (!Array.isArray(parsedData)) {
					console.warn(
						`[jabberwock] [readApiConversation] Parsed OLD data is not an array (got ${typeof parsedData}), returning empty. TaskId: ${taskId}, Path: ${oldPath}`,
					)
					return []
				}
				if (parsedData.length === 0) {
					console.error(
						`[jabberwock] [Jabberwock-Debug] readApiConversation: Found OLD API conversation history file (claude_messages.json), but it's empty (parsed as []). TaskId: ${taskId}, Path: ${oldPath}`,
					)
				}
				await fs.unlink(oldPath)
				return parsedData
			} catch (error) {
				console.warn(
					`[jabberwock] [readApiConversation] Error parsing OLD API conversation history file (claude_messages.json), returning empty. TaskId: ${taskId}, Path: ${oldPath}, Error: ${error}`,
				)
				// DO NOT unlink oldPath if parsing failed.
				return []
			}
		}
	}

	// If we reach here, neither the new nor the old history file was found.
	console.error(
		`[jabberwock] [Jabberwock-Debug] readApiConversation: API conversation history file not found for taskId: ${taskId}. Expected at: ${filePath}`,
	)
	return []
}

export async function saveApiMessages({
	messages,
	taskId,
	globalStoragePath,
}: {
	messages: ApiMessage[]
	taskId: string
	globalStoragePath: string
}) {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filePath = path.join(taskDir, GlobalFileNames.apiConversationHistory)
	await safeWriteJson(filePath, messages)
}

/**
 * Overwrites the API conversation history for a task and optionally syncs to UI.
 */
export async function overwriteApiConversationHistory(
	task: ITaskModel,
	newHistory: ApiMessage[],
	syncToUi: boolean = true,
): Promise<void> {
	task.apiConversationHistory = newHistory
	if (syncToUi) {
		const provider = task.providerRef?.deref()
		if (provider) {
			await postStateToWebview(provider)
		}
	}
}

/** Reasoning blocks stored in API messages use non-standard fields beyond ContentBlockParam */
interface ReasoningBlockFields {
	type: string
	encrypted_content?: string
	summary?: Anthropic.Messages.ContentBlockParam[]
	text?: string
	id?: string
}

type ReasoningItemForRequest = {
	type: "reasoning"
	encrypted_content: string
	id?: string
	summary?: Anthropic.Messages.ContentBlockParam[]
}

/**
 * Build a clean conversation history from stored API messages, handling
 * reasoning blocks, encrypted content, and thought signatures.
 *
 * @param preserveReasoning - Whether to preserve plain-text reasoning blocks for the API
 * @param messages - The stored API messages to clean
 * @returns Array of cleaned messages suitable for API requests
 */
export function buildCleanConversationHistory(
	preserveReasoning: boolean,
	messages: ApiMessage[],
): Array<Anthropic.Messages.MessageParam | ReasoningItemForRequest> {
	const cleanConversationHistory: (Anthropic.Messages.MessageParam | ReasoningItemForRequest)[] = []

	for (const msg of messages) {
		// Standalone reasoning: send encrypted, skip plain text
		if (msg.type === "reasoning") {
			if (msg.encrypted_content) {
				cleanConversationHistory.push({
					type: "reasoning",
					summary: msg.summary,
					encrypted_content: msg.encrypted_content!,
					...(msg.id ? { id: msg.id } : {}),
				})
			}
			continue
		}

		// Preferred path: assistant message with embedded reasoning as first content block
		if (msg.role === "assistant") {
			const rawContent = msg.content

			const contentArray: Anthropic.Messages.ContentBlockParam[] = Array.isArray(rawContent)
				? (rawContent as Anthropic.Messages.ContentBlockParam[])
				: rawContent !== undefined
					? ([
							{ type: "text", text: rawContent } satisfies Anthropic.Messages.TextBlockParam,
						] as Anthropic.Messages.ContentBlockParam[])
					: []

			const [first, ...rest] = contentArray

			// Check if this message has reasoning_details (OpenRouter format for Gemini 3, etc.)
			const msgWithDetails = msg as { reasoning_details?: Anthropic.Messages.MessageParam["content"] }
			const reasoningDetails = msgWithDetails.reasoning_details
			const hasReasoningDetails = Array.isArray(reasoningDetails)

			// Embedded reasoning: encrypted (send) or plain text (skip)
			const firstBlock = first as (Anthropic.Messages.ContentBlockParam | ReasoningBlockFields) | undefined
			const hasEncryptedReasoning =
				firstBlock?.type === "reasoning" && typeof firstBlock.encrypted_content === "string"
			const hasPlainTextReasoning = firstBlock?.type === "reasoning" && typeof firstBlock.text === "string"

			// Determine the assistant message handler based on content type
			const assistantHandlers: Record<
				string,
				() => {
					reasoningItem?: ReasoningItemForRequest
					assistantContent: Anthropic.Messages.MessageParam["content"]
				}
			> = {
				reasoning_details: () => {
					let assistantContent: Anthropic.Messages.MessageParam["content"]

					if (contentArray.length === 0) {
						assistantContent = ""
					} else if (contentArray.length === 1 && contentArray[0].type === "text") {
						assistantContent = (contentArray[0] as Anthropic.Messages.TextBlockParam).text
					} else {
						assistantContent = contentArray
					}

					return { assistantContent }
				},
				encrypted_reasoning: () => {
					const reasoningBlock = first as ReasoningBlockFields | undefined

					const reasoningItem: ReasoningItemForRequest = {
						type: "reasoning",
						summary: reasoningBlock?.summary ?? [],
						encrypted_content: reasoningBlock?.encrypted_content ?? "",
						...(reasoningBlock?.id ? { id: reasoningBlock.id } : {}),
					}

					let assistantContent: Anthropic.Messages.MessageParam["content"]

					if (rest.length === 0) {
						assistantContent = ""
					} else if (rest.length === 1 && rest[0].type === "text") {
						assistantContent = (rest[0] as Anthropic.Messages.TextBlockParam).text
					} else {
						assistantContent = rest
					}

					return { reasoningItem, assistantContent }
				},
				plain_text_reasoning: () => {
					const shouldPreserveForApi = preserveReasoning
					let assistantContent: Anthropic.Messages.MessageParam["content"]

					if (shouldPreserveForApi) {
						assistantContent = contentArray
					} else {
						if (rest.length === 0) {
							assistantContent = ""
						} else if (rest.length === 1 && rest[0].type === "text") {
							assistantContent = (rest[0] as Anthropic.Messages.TextBlockParam).text
						} else {
							assistantContent = rest
						}
					}

					return { assistantContent }
				},
				default: () => {
					return { assistantContent: contentArray }
				},
			}

			// Select the appropriate handler key
			let handlerKey: string
			if (hasReasoningDetails) {
				handlerKey = "reasoning_details"
			} else if (hasEncryptedReasoning) {
				handlerKey = "encrypted_reasoning"
			} else if (hasPlainTextReasoning) {
				handlerKey = "plain_text_reasoning"
			} else {
				handlerKey = "default"
			}

			const handler = assistantHandlers[handlerKey]
			const { reasoningItem, assistantContent } = handler()

			if (reasoningItem) {
				cleanConversationHistory.push(reasoningItem)
			}

			if (handlerKey === "reasoning_details") {
				cleanConversationHistory.push({
					role: "assistant",
					content: assistantContent,
					reasoning_details: reasoningDetails as Anthropic.Messages.MessageParam["content"],
				} as Anthropic.Messages.MessageParam & {
					reasoning_details: Anthropic.Messages.MessageParam["content"]
				})
			} else {
				cleanConversationHistory.push({
					role: "assistant",
					content: assistantContent,
				} satisfies Anthropic.Messages.MessageParam)
			}

			continue
		}

		// Default path for regular messages (no embedded reasoning)
		if (msg.role) {
			cleanConversationHistory.push({
				role: msg.role,
				content: msg.content as Anthropic.Messages.ContentBlockParam[] | string,
			})
		}
	}

	return cleanConversationHistory
}
