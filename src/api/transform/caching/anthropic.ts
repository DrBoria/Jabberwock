import OpenAI from "openai"

export function addCacheBreakpoints(systemPrompt: string, messages: OpenAI.Chat.ChatCompletionMessageParam[]) {
	type CachedTextPart = OpenAI.Chat.ChatCompletionContentPartText & { cache_control?: { type: "ephemeral" } }

	messages[0] = {
		role: "system",
		content: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }] as CachedTextPart[],
	} as OpenAI.Chat.ChatCompletionMessageParam

	// Ensure all user messages have content in array format first
	for (const msg of messages) {
		if (msg.role === "user" && typeof msg.content === "string") {
			msg.content = [{ type: "text", text: msg.content }]
		}
	}

	// Add `cache_control: ephemeral` to the last two user messages.
	// (Note: this works because we only ever add one user message at a
	// time, but if we added multiple we'd need to mark the user message
	// before the last assistant message.)
	messages
		.filter((msg) => msg.role === "user")
		.slice(-2)
		.forEach((msg) => {
			if (Array.isArray(msg.content)) {
				// NOTE: This is fine since env details will always be added
				// at the end. But if it wasn't there, and the user added a
				// image_url type message, it would pop a text part before
				// it and then move it after to the end.
				let lastTextPart = msg.content.filter((part) => part.type === "text").pop()

				if (!lastTextPart) {
					lastTextPart = { type: "text", text: "..." }
					msg.content.push(lastTextPart)
				}

				;(lastTextPart as CachedTextPart)["cache_control"] = { type: "ephemeral" }
			}
		})
}
