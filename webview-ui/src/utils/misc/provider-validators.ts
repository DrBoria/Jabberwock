import i18next from "i18next"
import type { ProviderSettings } from "@jabberwock/types"

type ProviderValidator = (apiConfiguration: ProviderSettings) => string | undefined

const validateOpenRouter = (apiConfiguration: ProviderSettings): string | undefined =>
	!apiConfiguration.openRouterApiKey ? i18next.t("settings:validation.apiKey") : undefined
const validateRequesty = (apiConfiguration: ProviderSettings): string | undefined =>
	!apiConfiguration.requestyApiKey ? i18next.t("settings:validation.apiKey") : undefined
const validateUnbound = (apiConfiguration: ProviderSettings): string | undefined =>
	!apiConfiguration.unboundApiKey ? i18next.t("settings:validation.apiKey") : undefined
const validateLiteLLM = (apiConfiguration: ProviderSettings): string | undefined =>
	!apiConfiguration.litellmApiKey ? i18next.t("settings:validation.apiKey") : undefined
const validateAnthropic = (apiConfiguration: ProviderSettings): string | undefined =>
	!apiConfiguration.apiKey ? i18next.t("settings:validation.apiKey") : undefined
const validateBedrock = (apiConfiguration: ProviderSettings): string | undefined =>
	!apiConfiguration.awsRegion ? i18next.t("settings:validation.awsRegion") : undefined
const validateVertex = (apiConfiguration: ProviderSettings): string | undefined =>
	!apiConfiguration.vertexProjectId || !apiConfiguration.vertexRegion
		? i18next.t("settings:validation.googleCloud")
		: undefined
const validateGemini = (apiConfiguration: ProviderSettings): string | undefined =>
	!apiConfiguration.geminiApiKey ? i18next.t("settings:validation.apiKey") : undefined
const validateOpenAiNative = (apiConfiguration: ProviderSettings): string | undefined =>
	!apiConfiguration.openAiNativeApiKey ? i18next.t("settings:validation.apiKey") : undefined
const validateMistral = (apiConfiguration: ProviderSettings): string | undefined =>
	!apiConfiguration.mistralApiKey ? i18next.t("settings:validation.apiKey") : undefined
const validateOpenAi = (apiConfiguration: ProviderSettings): string | undefined =>
	!apiConfiguration.openAiBaseUrl || !apiConfiguration.openAiApiKey || !apiConfiguration.openAiModelId
		? i18next.t("settings:validation.openAi")
		: undefined
const validateOllama = (apiConfiguration: ProviderSettings): string | undefined =>
	!apiConfiguration.ollamaModelId ? i18next.t("settings:validation.modelId") : undefined
const validateLmStudio = (apiConfiguration: ProviderSettings): string | undefined =>
	!apiConfiguration.lmStudioModelId ? i18next.t("settings:validation.modelId") : undefined
const validateVscodeLm = (apiConfiguration: ProviderSettings): string | undefined =>
	!apiConfiguration.vsCodeLmModelSelector ? i18next.t("settings:validation.modelSelector") : undefined
const validateFireworks = (apiConfiguration: ProviderSettings): string | undefined =>
	!apiConfiguration.fireworksApiKey ? i18next.t("settings:validation.apiKey") : undefined
const validateQwenCode = (apiConfiguration: ProviderSettings): string | undefined =>
	!apiConfiguration.qwenCodeOauthPath ? i18next.t("settings:validation.qwenCodeOauthPath") : undefined
const validateVercelAiGateway = (apiConfiguration: ProviderSettings): string | undefined =>
	!apiConfiguration.vercelAiGatewayApiKey ? i18next.t("settings:validation.apiKey") : undefined
const validateBaseten = (apiConfiguration: ProviderSettings): string | undefined =>
	!apiConfiguration.basetenApiKey ? i18next.t("settings:validation.apiKey") : undefined
const validateDeepSeek = (apiConfiguration: ProviderSettings): string | undefined =>
	!apiConfiguration.deepSeekApiKey ? i18next.t("settings:validation.apiKey") : undefined
const validateMoonshot = (apiConfiguration: ProviderSettings): string | undefined =>
	!apiConfiguration.moonshotApiKey ? i18next.t("settings:validation.apiKey") : undefined
const validateMinimax = (apiConfiguration: ProviderSettings): string | undefined =>
	!apiConfiguration.minimaxApiKey ? i18next.t("settings:validation.apiKey") : undefined
const validateXai = (apiConfiguration: ProviderSettings): string | undefined =>
	!apiConfiguration.xaiApiKey ? i18next.t("settings:validation.apiKey") : undefined
const validateSambaNova = (apiConfiguration: ProviderSettings): string | undefined =>
	!apiConfiguration.sambaNovaApiKey ? i18next.t("settings:validation.apiKey") : undefined
const validateZai = (apiConfiguration: ProviderSettings): string | undefined =>
	!apiConfiguration.zaiApiKey ? i18next.t("settings:validation.apiKey") : undefined

export const validators: Record<string, ProviderValidator> = {
	openrouter: validateOpenRouter,
	requesty: validateRequesty,
	unbound: validateUnbound,
	litellm: validateLiteLLM,
	anthropic: validateAnthropic,
	bedrock: validateBedrock,
	vertex: validateVertex,
	gemini: validateGemini,
	"openai-native": validateOpenAiNative,
	mistral: validateMistral,
	openai: validateOpenAi,
	ollama: validateOllama,
	lmstudio: validateLmStudio,
	"vscode-lm": validateVscodeLm,
	fireworks: validateFireworks,
	"qwen-code": validateQwenCode,
	"vercel-ai-gateway": validateVercelAiGateway,
	baseten: validateBaseten,
	deepseek: validateDeepSeek,
	moonshot: validateMoonshot,
	minimax: validateMinimax,
	xai: validateXai,
	sambanova: validateSambaNova,
	zai: validateZai,
}
