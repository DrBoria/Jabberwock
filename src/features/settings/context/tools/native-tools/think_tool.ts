import type OpenAI from "openai"

const thinkTool: OpenAI.Chat.ChatCompletionTool = {
	type: "function",
	function: {
		name: "think_tool",
		description:
			"Invoke deep reasoning to solve a complex problem. This tool routes the request to a specialized reasoning model (e.g., DeepSeek-R1) to provide structural analysis, logical reasoning, and detailed planning.",
		parameters: {
			type: "object",
			properties: {
				prompt: {
					type: "string",
					description: "The specific problem or scenario to think about deeply.",
				},
			},
			required: ["prompt"],
		},
	},
}

export default thinkTool
