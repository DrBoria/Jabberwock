import {
	anthropicModels,
	basetenModels,
	bedrockModels,
	deepSeekModels,
	fireworksModels,
	geminiModels,
	mistralModels,
	moonshotModels,
	openAiCodexModels,
	openAiNativeModels,
	qwenCodeModels,
	sambaNovaModels,
	vertexModels,
	vscodeLlmModels,
	xaiModels,
	internationalZAiModels,
	minimaxModels,
} from "../providers/index.ts"
import { ProviderName } from "../settings/provider/categories.ts"

export const MODELS_BY_PROVIDER: Record<
	Exclude<ProviderName, "fake-ai" | "gemini-cli" | "openai">,
	{ id: ProviderName; label: string; models: string[] }
> = {
	anthropic: {
		id: "anthropic",
		label: "Anthropic",
		models: Object.keys(anthropicModels),
	},
	bedrock: {
		id: "bedrock",
		label: "Amazon Bedrock",
		models: Object.keys(bedrockModels),
	},
	deepseek: {
		id: "deepseek",
		label: "DeepSeek",
		models: Object.keys(deepSeekModels),
	},
	fireworks: {
		id: "fireworks",
		label: "Fireworks",
		models: Object.keys(fireworksModels),
	},
	gemini: {
		id: "gemini",
		label: "Google Gemini",
		models: Object.keys(geminiModels),
	},
	mistral: {
		id: "mistral",
		label: "Mistral",
		models: Object.keys(mistralModels),
	},
	moonshot: {
		id: "moonshot",
		label: "Moonshot",
		models: Object.keys(moonshotModels),
	},
	minimax: {
		id: "minimax",
		label: "MiniMax",
		models: Object.keys(minimaxModels),
	},
	"openai-codex": {
		id: "openai-codex",
		label: "OpenAI - ChatGPT Plus/Pro",
		models: Object.keys(openAiCodexModels),
	},
	"openai-native": {
		id: "openai-native",
		label: "OpenAI",
		models: Object.keys(openAiNativeModels),
	},
	"qwen-code": { id: "qwen-code", label: "Qwen Code", models: Object.keys(qwenCodeModels) },
	jabberwock: { id: "jabberwock", label: "Jabberwock Router", models: [] },
	sambanova: {
		id: "sambanova",
		label: "SambaNova",
		models: Object.keys(sambaNovaModels),
	},
	vertex: {
		id: "vertex",
		label: "GCP Vertex AI",
		models: Object.keys(vertexModels),
	},
	"vscode-lm": {
		id: "vscode-lm",
		label: "VS Code LM API",
		models: Object.keys(vscodeLlmModels),
	},
	xai: { id: "xai", label: "xAI (Grok)", models: Object.keys(xaiModels) },
	zai: { id: "zai", label: "Z.ai", models: Object.keys(internationalZAiModels) },
	baseten: { id: "baseten", label: "Baseten", models: Object.keys(basetenModels) },

	// Dynamic providers; models pulled from remote APIs.
	litellm: { id: "litellm", label: "LiteLLM", models: [] },
	openrouter: { id: "openrouter", label: "OpenRouter", models: [] },
	requesty: { id: "requesty", label: "Requesty", models: [] },
	unbound: { id: "unbound", label: "Unbound", models: [] },
	"vercel-ai-gateway": { id: "vercel-ai-gateway", label: "Vercel AI Gateway", models: [] },

	// Local providers; models discovered from localhost endpoints.
	lmstudio: { id: "lmstudio", label: "LM Studio", models: [] },
	ollama: { id: "ollama", label: "Ollama", models: [] },
}
