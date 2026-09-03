import type OpenAI from "openai"

export default {
	type: "function",
	function: {
		name: "context_recall",
		description:
			"Expand an archived context node or sequence range back into raw verbatim message content, including thinking blocks byte-for-byte (lossless recall). Use the nodeId returned by a context_search result; msg:<taskId>:<seq> addresses a single message.",
		parameters: {
			type: "object",
			properties: {
				nodeId: {
					type: "string",
					description: "Node id from a search result, or msg:<taskId>:<seq> for a single archived message.",
				},
				fromSeq: {
					type: "integer",
					minimum: 1,
					description: "Optional inclusive start sequence (clamped to the node range).",
				},
				toSeq: {
					type: "integer",
					minimum: 1,
					description: "Optional inclusive end sequence (clamped to the node range).",
				},
				maxTokens: {
					type: "integer",
					minimum: 1,
					description:
						"Token budget for the recalled content (default 8000; clamped against the model window when one is supplied by the caller).",
				},
			},
			required: [],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
