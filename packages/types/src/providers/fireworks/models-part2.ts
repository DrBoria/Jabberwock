import type { ModelInfo } from "../../models/model.ts"

export const fireworksModelsPart2 = {
	"accounts/fireworks/models/glm-4p5": {
		maxTokens: 16384,
		contextWindow: 128000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.55,
		outputPrice: 2.19,
		description:
			"Z.ai GLM-4.5 with 355B total parameters and 32B active parameters. Features unified reasoning, coding, and intelligent agent capabilities.",
	},
	"accounts/fireworks/models/glm-4p5-air": {
		maxTokens: 16384,
		contextWindow: 128000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.55,
		outputPrice: 2.19,
		description:
			"Z.ai GLM-4.5-Air with 106B total parameters and 12B active parameters. Features unified reasoning, coding, and intelligent agent capabilities.",
	},
	"accounts/fireworks/models/glm-4p6": {
		maxTokens: 25344,
		contextWindow: 198000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.55,
		outputPrice: 2.19,
		description:
			"Z.ai GLM-4.6 is an advanced coding model with exceptional performance on complex programming tasks. Features improved reasoning capabilities and enhanced code generation quality, making it ideal for software development workflows.",
	},
	"accounts/fireworks/models/gpt-oss-20b": {
		maxTokens: 16384,
		contextWindow: 128000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.07,
		outputPrice: 0.3,
		description:
			"OpenAI gpt-oss-20b: Compact model for local/edge deployments. Optimized for low-latency and resource-constrained environments with chain-of-thought output, adjustable reasoning, and agentic workflows.",
	},
	"accounts/fireworks/models/gpt-oss-120b": {
		maxTokens: 16384,
		contextWindow: 128000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.15,
		outputPrice: 0.6,
		description:
			"OpenAI gpt-oss-120b: Production-grade, general-purpose model that fits on a single H100 GPU. Features complex reasoning, configurable effort, full chain-of-thought transparency, and supports function calling, tool use, and structured outputs.",
	},
	"accounts/fireworks/models/minimax-m2p1": {
		maxTokens: 4096,
		contextWindow: 204800,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.3,
		outputPrice: 1.2,
		description:
			"MiniMax M2.1 is an upgraded version of M2 with improved performance on complex reasoning, coding, and long-context understanding tasks.",
	},
	"accounts/fireworks/models/deepseek-v3p2": {
		maxTokens: 16384,
		contextWindow: 163840,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.56,
		outputPrice: 1.68,
		description:
			"DeepSeek V3.2 is the latest iteration of the V3 model family with enhanced reasoning capabilities, improved code generation, and better instruction following.",
	},
	"accounts/fireworks/models/glm-4p7": {
		maxTokens: 25344,
		contextWindow: 198000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.55,
		outputPrice: 2.19,
		description:
			"Z.ai GLM-4.7 is the latest coding model with exceptional performance on complex programming tasks. Features improved reasoning capabilities and enhanced code generation quality.",
	},
	"accounts/fireworks/models/llama-v3p3-70b-instruct": {
		maxTokens: 16384,
		contextWindow: 131072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.9,
		outputPrice: 0.9,
		description:
			"Meta Llama 3.3 70B Instruct is a highly capable instruction-tuned model with strong reasoning, coding, and general task performance.",
	},
	"accounts/fireworks/models/llama4-maverick-instruct-basic": {
		maxTokens: 16384,
		contextWindow: 131072,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0.22,
		outputPrice: 0.88,
		description:
			"Llama 4 Maverick is Meta's latest multimodal model with vision capabilities, optimized for instruction following and coding tasks.",
	},
	"accounts/fireworks/models/llama4-scout-instruct-basic": {
		maxTokens: 16384,
		contextWindow: 131072,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0.15,
		outputPrice: 0.6,
		description:
			"Llama 4 Scout is a smaller, faster variant of Llama 4 with multimodal capabilities, ideal for quick iterations and cost-effective deployments.",
	},
} as const satisfies Record<string, ModelInfo>
