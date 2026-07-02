import { Anthropic } from "@anthropic-ai/sdk"
import { ConversationRole, Message, ContentBlock } from "@aws-sdk/client-bedrock-runtime"
import { sanitizeOpenAiCallId } from "@utils/mcp"

interface BedrockMessageContent {
	type: "text" | "image" | "video" | "tool_use" | "tool_result"
	text?: string
	source?: {
		type: "base64"
		data: string | Uint8Array // string for Anthropic, Uint8Array for Bedrock
		media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp"
	}
	// Video specific fields
	format?: string
	s3Location?: {
		uri: string
		bucketOwner?: string
	}
	// Tool use and result fields
	toolUseId?: string
	name?: string
	input?: Record<string, unknown>
	output?: unknown // Used for tool_result type
}

function convertBase64ToUint8Array(base64: string): Uint8Array {
	const binaryString = atob(base64)
	const byteArray = new Uint8Array(binaryString.length)
	for (let i = 0; i < binaryString.length; i++) {
		byteArray[i] = binaryString.charCodeAt(i)
	}
	return byteArray
}

function convertTextBlock(messageBlock: BedrockMessageContent & Record<string, unknown>): ContentBlock {
	return { text: messageBlock.text || "" } as ContentBlock
}

function convertImageBlock(messageBlock: BedrockMessageContent & Record<string, unknown>): ContentBlock {
	const source = messageBlock.source as { type: string; data: string | Uint8Array; media_type: string }
	const byteArray = typeof source.data === "string" ? convertBase64ToUint8Array(source.data) : source.data
	const format = source.media_type.split("/")[1]
	if (!["png", "jpeg", "gif", "webp"].includes(format)) {
		throw new Error(`Unsupported image format: ${format}`)
	}
	return {
		image: {
			format: format as "png" | "jpeg" | "gif" | "webp",
			source: { bytes: byteArray },
		},
	} as ContentBlock
}

function convertToolUseBlock(messageBlock: BedrockMessageContent & Record<string, unknown>): ContentBlock {
	return {
		toolUse: {
			toolUseId: sanitizeOpenAiCallId((messageBlock.id as string) || ""),
			name: (messageBlock.name as string) || "",
			input: (messageBlock.input as Record<string, unknown>) || {},
		},
	} as ContentBlock
}

function convertToolResultFromContent(
	messageBlock: BedrockMessageContent & Record<string, unknown>,
): ContentBlock | undefined {
	const content = messageBlock.content as string | Array<{ type: string; text: string }> | undefined
	if (!content) return undefined

	if (typeof content === "string") {
		return {
			toolResult: {
				toolUseId: sanitizeOpenAiCallId((messageBlock.tool_use_id as string) || ""),
				content: [{ text: content }],
				status: "success",
			},
		} as ContentBlock
	}

	if (Array.isArray(content)) {
		return {
			toolResult: {
				toolUseId: sanitizeOpenAiCallId((messageBlock.tool_use_id as string) || ""),
				content: content.map((item) => ({
					text: typeof item === "string" ? item : item.text || String(item),
				})),
				status: "success",
			},
		} as ContentBlock
	}

	return undefined
}

function convertToolResultFromOutput(messageBlock: BedrockMessageContent & Record<string, unknown>): ContentBlock {
	const output = messageBlock.output as string | Array<{ text?: string; type?: string }> | undefined

	if (typeof output === "string") {
		return {
			toolResult: {
				toolUseId: sanitizeOpenAiCallId((messageBlock.tool_use_id as string) || ""),
				content: [{ text: output }],
				status: "success",
			},
		} as ContentBlock
	}

	if (Array.isArray(output)) {
		return {
			toolResult: {
				toolUseId: sanitizeOpenAiCallId((messageBlock.tool_use_id as string) || ""),
				content: output.map((part) => {
					if (part.text) return { text: part.text }
					if (part.type === "image") return { text: "(see following message for image)" }
					return { text: String(part) }
				}),
				status: "success",
			},
		} as ContentBlock
	}

	return {
		toolResult: {
			toolUseId: sanitizeOpenAiCallId((messageBlock.tool_use_id as string) || ""),
			content: [{ text: String((messageBlock.output as string) || "") }],
			status: "success",
		},
	} as ContentBlock
}

function convertToolResultBlock(messageBlock: BedrockMessageContent & Record<string, unknown>): ContentBlock {
	const fromContent = convertToolResultFromContent(messageBlock)
	if (fromContent) return fromContent
	return convertToolResultFromOutput(messageBlock)
}

function convertVideoBlock(messageBlock: BedrockMessageContent & Record<string, unknown>): ContentBlock {
	const videoContent = messageBlock.s3Location
		? {
				s3Location: {
					uri: (messageBlock.s3Location as { uri: string }).uri,
					bucketOwner: (messageBlock.s3Location as { uri: string; bucketOwner?: string }).bucketOwner,
				},
			}
		: messageBlock.source

	return {
		video: {
			format: "mp4",
			source: videoContent,
		},
	} as ContentBlock
}

function convertBedrockBlock(block: BedrockMessageContent & Record<string, unknown>): ContentBlock {
	switch (block.type) {
		case "text":
			return convertTextBlock(block)
		case "image":
			if (!block.source) break
			return convertImageBlock(block)
		case "tool_use":
			return convertToolUseBlock(block)
		case "tool_result":
			return convertToolResultBlock(block)
		case "video":
			return convertVideoBlock(block)
	}
	return { text: "[Unknown Block Type]" } as ContentBlock
}

/**
 * Convert Anthropic messages to Bedrock Converse format
 * @param anthropicMessages Messages in Anthropic format
 */
export function convertToBedrockConverseMessages(anthropicMessages: Anthropic.Messages.MessageParam[]): Message[] {
	return anthropicMessages.map((anthropicMessage) => {
		const role: ConversationRole = anthropicMessage.role === "assistant" ? "assistant" : "user"

		if (typeof anthropicMessage.content === "string") {
			return {
				role,
				content: [{ text: anthropicMessage.content }] as ContentBlock[],
			}
		}

		const content = anthropicMessage.content.map((block) =>
			convertBedrockBlock(block as BedrockMessageContent & Record<string, unknown>),
		)

		return { role, content }
	})
}
