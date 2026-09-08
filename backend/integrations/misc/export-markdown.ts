import { Anthropic } from "@anthropic-ai/sdk"
import * as fs from "fs/promises"
import type { IUri } from "@jabberwock/types"
import { getUiDialogs } from "@features/foundation/capabilities/registry"
import { getHostContext } from "@features/foundation/host-context/context"

// Extended content block types to support new Anthropic API features
interface ReasoningBlock {
	type: "reasoning"
	text: string
}

interface ThoughtSignatureBlock {
	type: "thoughtSignature"
}

export type ExtendedContentBlock = Anthropic.Messages.ContentBlockParam | ReasoningBlock | ThoughtSignatureBlock

export function getTaskFileName(dateTs: number): string {
	const date = new Date(dateTs)
	const month = date.toLocaleString("en-US", { month: "short" }).toLowerCase()
	const day = date.getDate()
	const year = date.getFullYear()
	let hours = date.getHours()
	const minutes = date.getMinutes().toString().padStart(2, "0")
	const seconds = date.getSeconds().toString().padStart(2, "0")
	const ampm = hours >= 12 ? "pm" : "am"
	hours = hours % 12
	hours = hours ? hours : 12 // the hour '0' should be '12'
	return `roo_task_${month}-${day}-${year}_${hours}-${minutes}-${seconds}-${ampm}.md`
}

export async function downloadTask(
	dateTs: number,
	conversationHistory: Anthropic.MessageParam[],
	defaultUri: IUri,
): Promise<IUri | undefined> {
	// File name
	const _fileName = getTaskFileName(dateTs)

	// Generate markdown
	const markdownContent = conversationHistory
		.map((message) => {
			const role = message.role === "user" ? "**User:**" : "**Assistant:**"
			const content = Array.isArray(message.content)
				? message.content.map((block) => formatContentBlockToMarkdown(block as ExtendedContentBlock)).join("\n")
				: message.content
			return `${role}\n\n${content}\n\n`
		})
		.join("---\n\n")

	// Prompt user for save location
	const saveUri = await getUiDialogs().showSaveDialog({
		filters: { Markdown: ["md"] },
		defaultUri,
	})

	if (saveUri) {
		// Write content to the selected location
		await fs.writeFile(saveUri.fsPath, markdownContent, "utf-8")
		getHostContext()?.hostCommands?.openFileInEditor?.(saveUri.fsPath, { preview: true })
		return saveUri
	}
	return undefined
}

function formatToolUseInput(input: unknown): string {
	if (typeof input === "object" && input !== null) {
		return Object.entries(input)
			.map(([key, value]) => {
				const formattedKey = key.charAt(0).toUpperCase() + key.slice(1)
				const formattedValue =
					typeof value === "object" && value !== null ? JSON.stringify(value, null, 2) : String(value)
				return `${formattedKey}: ${formattedValue}`
			})
			.join("\n")
	}
	return String(input)
}

function formatToolResultContent(content: ExtendedContentBlock[] | string, isError: boolean | undefined): string {
	const toolName = "Tool"
	if (typeof content === "string") {
		return `[${toolName}${isError ? " (Error)" : ""}]\n${content}`
	}
	if (Array.isArray(content)) {
		return `[${toolName}${isError ? " (Error)" : ""}]\n${content
			.map((contentBlock) => formatContentBlockToMarkdown(contentBlock))
			.join("\n")}`
	}
	return `[${toolName}${isError ? " (Error)" : ""}]`
}

export function formatContentBlockToMarkdown(block: ExtendedContentBlock): string {
	switch (block.type) {
		case "text":
			return block.text
		case "image":
			return `[Image]`
		case "tool_use":
			return `[Tool Use: ${block.name}]\n${formatToolUseInput(block.input)}`
		case "tool_result":
			return formatToolResultContent(block.content as ExtendedContentBlock[] | string, block.is_error)
		case "reasoning":
			return `[Reasoning]\n${block.text}`
		case "thoughtSignature":
			return ""
		default:
			return `[Unexpected content type: ${block.type}]`
	}
}

export function findToolName(toolCallId: string, messages: Anthropic.MessageParam[]): string {
	for (const message of messages) {
		if (Array.isArray(message.content)) {
			for (const block of message.content) {
				if (block.type === "tool_use" && block.id === toolCallId) {
					return block.name
				}
			}
		}
	}
	return "Unknown Tool"
}
