import { Anthropic } from "@anthropic-ai/sdk"
import { Content, Part } from "@google/genai"

type ThoughtSignatureContentBlock = {
	type: "thoughtSignature"
	thoughtSignature?: string
}

type ReasoningContentBlock = {
	type: "reasoning"
	text: string
}

type ExtendedContentBlockParam = Anthropic.ContentBlockParam | ThoughtSignatureContentBlock | ReasoningContentBlock
type ExtendedAnthropicContent = string | ExtendedContentBlockParam[]

// Extension type to safely add thoughtSignature to Part
type PartWithThoughtSignature = Part & {
	thoughtSignature?: string
}

function isThoughtSignatureContentBlock(block: ExtendedContentBlockParam): block is ThoughtSignatureContentBlock {
	return block.type === "thoughtSignature"
}

function findActiveThoughtSignature(content: ExtendedAnthropicContent): string | undefined {
	if (!Array.isArray(content)) return undefined

	const sigBlock = content.find((block) => isThoughtSignatureContentBlock(block)) as
		| ThoughtSignatureContentBlock
		| undefined
	return sigBlock?.thoughtSignature
}

function buildTextPart(block: Extract<ExtendedContentBlockParam, { type: "text" }>): Part {
	return { text: block.text }
}

function buildImagePart(block: Extract<ExtendedContentBlockParam, { type: "image" }>): Part {
	if (block.source.type !== "base64") {
		throw new Error("Unsupported image source type")
	}
	return { inlineData: { data: block.source.data, mimeType: block.source.media_type } }
}

function buildToolUsePart(
	block: Extract<ExtendedContentBlockParam, { type: "tool_use" }>,
	functionCallSignature: string | undefined,
): Part {
	return {
		functionCall: {
			name: block.name,
			args: block.input as Record<string, unknown>,
		},
		...(functionCallSignature ? { thoughtSignature: functionCallSignature } : {}),
	} as Part
}

function splitToolResultContent(blockContent: Anthropic.ContentBlockParam[]): {
	textParts: string[]
	imageParts: Part[]
} {
	const textParts: string[] = []
	const imageParts: Part[] = []

	for (const item of blockContent) {
		if (item.type === "text") {
			textParts.push(item.text)
		} else if (item.type === "image" && item.source.type === "base64") {
			const { data, media_type } = item.source
			imageParts.push({ inlineData: { data, mimeType: media_type } })
		}
	}

	return { textParts, imageParts }
}

function formatToolResultResponse(toolName: string, textParts: string[], imageParts: Part[]): Part[] {
	const contentText = textParts.join("\n\n") + (imageParts.length > 0 ? "\n\n(See next part for image)" : "")
	return [{ functionResponse: { name: toolName, response: { name: toolName, content: contentText } } }, ...imageParts]
}

function buildToolResultParts(
	block: Extract<ExtendedContentBlockParam, { type: "tool_result" }>,
	toolIdToName: Map<string, string> | undefined,
): Part[] {
	if (!block.content) {
		return []
	}

	const toolName = toolIdToName?.get(block.tool_use_id)
	if (!toolName) {
		const availableIds = toolIdToName ? Array.from(toolIdToName.keys()).join(", ") : "none"
		throw new Error(
			`Unable to find tool name for tool_use_id "${block.tool_use_id}". ` +
				`This indicates the conversation history is missing the corresponding tool_use block. ` +
				`Available tool IDs: ${availableIds}`,
		)
	}

	if (typeof block.content === "string") {
		return [{ functionResponse: { name: toolName, response: { name: toolName, content: block.content } } }]
	}

	if (!Array.isArray(block.content)) {
		return []
	}

	const { textParts, imageParts } = splitToolResultContent(block.content)
	return formatToolResultResponse(toolName, textParts, imageParts)
}

function convertBlockToParts(
	block: ExtendedContentBlockParam,
	functionCallSignature: string | undefined,
	toolIdToName: Map<string, string> | undefined,
): Part[] {
	if (isThoughtSignatureContentBlock(block)) {
		return []
	}

	switch (block.type) {
		case "text":
			return [buildTextPart(block)]
		case "image":
			return [buildImagePart(block)]
		case "tool_use":
			return [buildToolUsePart(block, functionCallSignature)]
		case "tool_result":
			return buildToolResultParts(block, toolIdToName)
		default:
			console.warn(`[jabberwock] Skipping unsupported content block type: ${(block as { type: string }).type}`)
			return []
	}
}

function attachThoughtSignatureToParts(parts: Part[], activeThoughtSignature: string): void {
	const hasSignature = parts.some((p) => "thoughtSignature" in p)

	if (hasSignature) return

	if (parts.length > 0) {
		;(parts[0] as PartWithThoughtSignature).thoughtSignature = activeThoughtSignature
	} else {
		const placeholder: PartWithThoughtSignature = { text: "", thoughtSignature: activeThoughtSignature }
		parts.push(placeholder)
	}
}

function deduplicateSignatures(parts: Part[]): void {
	let seenFirstFunctionCall = false
	for (const part of parts) {
		if (
			part &&
			typeof part === "object" &&
			"functionCall" in part &&
			(part as Record<string, unknown>).functionCall
		) {
			const partWithSig = part as PartWithThoughtSignature
			if (!seenFirstFunctionCall) {
				seenFirstFunctionCall = true
			} else {
				delete partWithSig.thoughtSignature
			}
		}
	}
}

export function convertAnthropicContentToGemini(
	content: ExtendedAnthropicContent,
	options?: { includeThoughtSignatures?: boolean; toolIdToName?: Map<string, string> },
): Part[] {
	const includeThoughtSignatures = options?.includeThoughtSignatures ?? true
	const toolIdToName = options?.toolIdToName

	const activeThoughtSignature = findActiveThoughtSignature(content)

	const functionCallSignature = includeThoughtSignatures
		? activeThoughtSignature || "skip_thought_signature_validator"
		: undefined

	if (typeof content === "string") {
		return [{ text: content }]
	}

	const parts = content.flatMap((block) => convertBlockToParts(block, functionCallSignature, toolIdToName))

	if (includeThoughtSignatures && activeThoughtSignature) {
		attachThoughtSignatureToParts(parts, activeThoughtSignature)
	}

	if (includeThoughtSignatures) {
		deduplicateSignatures(parts)
	}

	return parts
}

export function convertAnthropicMessageToGemini(
	message: Anthropic.Messages.MessageParam,
	options?: { includeThoughtSignatures?: boolean; toolIdToName?: Map<string, string> },
): Content[] {
	const parts = convertAnthropicContentToGemini(message.content, options)

	if (parts.length === 0) {
		return []
	}

	return [
		{
			role: message.role === "assistant" ? "model" : "user",
			parts,
		},
	]
}
