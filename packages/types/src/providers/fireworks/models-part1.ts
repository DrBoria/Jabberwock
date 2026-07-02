import type { ModelInfo } from "../../models/model.ts"

export const fireworksModelsPart1 = {
	"accounts/fireworks/models/kimi-k2-instruct-0905": {
		maxTokens: 16384,
		contextWindow: 262144,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 0.6,
		outputPrice: 2.5,
		cacheReadsPrice: 0.15,
		description:
			"Kimi K2 model gets a new version update: Agentic coding: more accurate, better generalization across scaffolds. Frontend coding: improved aesthetics and functionalities on web, 3d, and other tasks. Context length: extended from 128k to 256k, providing better long-horizon support.",
	},
	"accounts/fireworks/models/kimi-k2-instruct": {
		maxTokens: 16384,
		contextWindow: 128000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.6,
		outputPrice: 2.5,
		description:
			"Kimi K2 is a state-of-the-art mixture-of-experts (MoE) language model with 32 billion activated parameters and 1 trillion total parameters. Trained with the Muon optimizer, Kimi K2 achieves exceptional performance across frontier knowledge, reasoning, and coding tasks while being meticulously optimized for agentic capabilities.",
	},
	"accounts/fireworks/models/kimi-k2-thinking": {
		maxTokens: 16000,
		contextWindow: 256000,
		supportsImages: false,
		supportsPromptCache: true,
		supportsTemperature: true,
		preserveReasoning: true,
		defaultTemperature: 1.0,
		inputPrice: 0.6,
		outputPrice: 2.5,
		cacheReadsPrice: 0.15,
		description:
			"The kimi-k2-thinking model is a general-purpose agentic reasoning model developed by Moonshot AI. Thanks to its strength in deep reasoning and multi-turn tool use, it can solve even the hardest problems.",
	},
	"accounts/fireworks/models/kimi-k2p5": {
		maxTokens: 16384,
		contextWindow: 262144,
		supportsImages: true,
		supportsPromptCache: true,
		inputPrice: 0.6,
		outputPrice: 3.0,
		cacheReadsPrice: 0.1,
		description:
			"Kimi K2.5 is Moonshot AI's flagship agentic model and a new SOTA open model. It unifies vision and text, thinking and non-thinking modes, and single-agent and multi-agent execution into one model. Fireworks enables users to control the reasoning behavior and inspect its reasoning history for greater transparency.",
	},
	"accounts/fireworks/models/minimax-m2": {
		maxTokens: 4096,
		contextWindow: 204800,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.3,
		outputPrice: 1.2,
		description:
			"MiniMax M2 is a high-performance language model with 204.8K context window, optimized for long-context understanding and generation tasks.",
	},
	"accounts/fireworks/models/qwen3-235b-a22b-instruct-2507": {
		maxTokens: 32768,
		contextWindow: 256000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.22,
		outputPrice: 0.88,
		description: "Latest Qwen3 thinking model, competitive against the best closed source models in Jul 2025.",
	},
	"accounts/fireworks/models/qwen3-coder-480b-a35b-instruct": {
		maxTokens: 32768,
		contextWindow: 256000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.45,
		outputPrice: 1.8,
		description: "Qwen3's most agentic code model to date.",
	},
	"accounts/fireworks/models/deepseek-r1-0528": {
		maxTokens: 20480,
		contextWindow: 160000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 3,
		outputPrice: 8,
		description:
			"05/28 updated checkpoint of Deepseek R1. Its overall performance is now approaching that of leading models, such as O3 and Gemini 2.5 Pro. Compared to the previous version, the upgraded model shows significant improvements in handling complex reasoning tasks, and this version also offers a reduced hallucination rate, enhanced support for function calling, and better experience for vibe coding. Note that fine-tuning for this model is only available through contacting fireworks at https://fireworks.ai/company/contact-us.",
	},
	"accounts/fireworks/models/deepseek-v3": {
		maxTokens: 16384,
		contextWindow: 128000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.9,
		outputPrice: 0.9,
		description:
			"A strong Mixture-of-Experts (MoE) language model with 671B total parameters with 37B activated for each token from Deepseek. Note that fine-tuning for this model is only available through contacting fireworks at https://fireworks.ai/company/contact-us.",
	},
	"accounts/fireworks/models/deepseek-v3p1": {
		maxTokens: 16384,
		contextWindow: 163840,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.56,
		outputPrice: 1.68,
		description:
			"DeepSeek v3.1 is an improved version of the v3 model with enhanced performance, better reasoning capabilities, and improved code generation. This Mixture-of-Experts (MoE) model maintains the same 671B total parameters with 37B activated per token.",
	},
} as const satisfies Record<string, ModelInfo>
