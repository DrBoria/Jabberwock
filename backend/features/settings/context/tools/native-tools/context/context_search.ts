import type OpenAI from "openai"

export default {
	type: "function",
	function: {
		name: "context_search",
		description:
			"Search archived conversation context with full-text keyword matching and return ranked snippets (message or summary nodes) for locating where something was discussed before recalling it verbatim via the context_recall tool.",
		parameters: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description:
						"Keyword query; terms are OR-matched against archived message text and node summaries.",
				},
				taskId: { type: "string", description: "Optional task id to restrict the search scope." },
				scope: {
					type: "string",
					enum: ["messages", "summaries", "all"],
					description: "Which archive layer(s) to search (default all).",
				},
				roleFilter: {
					type: "array",
					items: { type: "string", enum: ["user", "assistant", "tool", "system"] },
					description: "Optional message roles to include.",
				},
				limit: {
					type: "integer",
					minimum: 1,
					maximum: 50,
					description: "Maximum number of results (default 10).",
				},
			},
			required: ["query"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
