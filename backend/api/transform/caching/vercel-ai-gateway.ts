import OpenAI from "openai"

export function addCacheBreakpoints(systemPrompt: string, messages: OpenAI.Chat.ChatCompletionMessageParam[]) {
	type CachedTextPart = OpenAI.Chat.ChatCompletionContentPartText & { cache_control?: { type: "ephemeral" } }

	// Apply cache_control to system message at the message level
	messages[0] = {
		role: "system",
		content: systemPrompt,
		cache_control: { type: "ephemeral" },
	} as OpenAI.Chat.ChatCompletionMessageParam

	// Add cache_control to the last two user messages for conversation context caching
	const lastTwoUserMessages = messages.filter((msg) => msg.role === "user").slice(-2)

	lastTwoUserMessages.forEach((msg) => {
		if (typeof msg.content === "string" && msg.content.length > 0) {
			msg.content = [{ type: "text", text: msg.content }]
		}

		if (Array.isArray(msg.content)) {
			// Find the last text part in the message content
			let lastTextPart = msg.content.filter((part) => part.type === "text").pop()

			if (lastTextPart && lastTextPart.text && lastTextPart.text.length > 0) {
				;(lastTextPart as CachedTextPart)["cache_control"] = { type: "ephemeral" }
			}
		}
	})
}
