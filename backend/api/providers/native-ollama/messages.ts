import { Anthropic } from "@anthropic-ai/sdk"
import { Message } from "ollama"

export function convertToOllamaMessages(anthropicMessages: Anthropic.Messages.MessageParam[]): Message[] {
	const ollamaMessages: Message[] = []

	for (const anthropicMessage of anthropicMessages) {
		if (typeof anthropicMessage.content === "string") {
			ollamaMessages.push({
				role: anthropicMessage.role,
				content: anthropicMessage.content,
			})
		} else {
			if (anthropicMessage.role === "user") {
				const { nonToolMessages, toolMessages } = anthropicMessage.content.reduce<{
					nonToolMessages: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[]
					toolMessages: Anthropic.ToolResultBlockParam[]
				}>(
					(acc, part) => {
						if (part.type === "tool_result") {
							acc.toolMessages.push(part)
						} else if (part.type === "text" || part.type === "image") {
							acc.nonToolMessages.push(part)
						}
						return acc
					},
					{ nonToolMessages: [], toolMessages: [] },
				)

				const toolResultImages: string[] = []
				toolMessages.forEach((toolMessage) => {
					let content: string

					if (typeof toolMessage.content === "string") {
						content = toolMessage.content
					} else {
						content =
							toolMessage.content
								?.map((part) => {
									if (part.type === "image") {
										if ("source" in part && part.source.type === "base64") {
											toolResultImages.push(part.source.data)
										}
										return "(see following user message for image)"
									}
									return part.text
								})
								.join("\n") ?? ""
					}
					ollamaMessages.push({
						role: "user",
						images: toolResultImages.length > 0 ? toolResultImages : undefined,
						content: content,
					})
				})

				if (nonToolMessages.length > 0) {
					const textContent = nonToolMessages
						.filter((part) => part.type === "text")
						.map((part) => part.text)
						.join("\n")

					const imageData: string[] = []
					nonToolMessages.forEach((part) => {
						if (part.type === "image" && "source" in part && part.source.type === "base64") {
							imageData.push(part.source.data)
						}
					})

					ollamaMessages.push({
						role: "user",
						content: textContent,
						images: imageData.length > 0 ? imageData : undefined,
					})
				}
			} else if (anthropicMessage.role === "assistant") {
				const { nonToolMessages, toolMessages } = anthropicMessage.content.reduce<{
					nonToolMessages: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[]
					toolMessages: Anthropic.ToolUseBlockParam[]
				}>(
					(acc, part) => {
						if (part.type === "tool_use") {
							acc.toolMessages.push(part)
						} else if (part.type === "text" || part.type === "image") {
							acc.nonToolMessages.push(part)
						}
						return acc
					},
					{ nonToolMessages: [], toolMessages: [] },
				)

				let content: string = ""
				if (nonToolMessages.length > 0) {
					content = nonToolMessages
						.map((part) => {
							if (part.type === "image") {
								return ""
							}
							return part.text
						})
						.join("\n")
				}

				const toolCalls =
					toolMessages.length > 0
						? toolMessages.map((tool) => ({
								function: {
									name: tool.name,
									arguments: tool.input as Record<string, unknown>,
								},
							}))
						: undefined

				ollamaMessages.push({
					role: "assistant",
					content,
					tool_calls: toolCalls,
				})
			}
		}
	}

	return ollamaMessages
}
