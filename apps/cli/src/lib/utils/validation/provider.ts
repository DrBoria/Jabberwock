import { JabberwockSettings } from "@jabberwock/types"

import type { SupportedProvider } from "@/types/index.js"

const envVarMap: Record<SupportedProvider, string> = {
	anthropic: "ANTHROPIC_API_KEY",
	"openai-native": "OPENAI_API_KEY",
	gemini: "GOOGLE_API_KEY",
	openrouter: "OPENROUTER_API_KEY",
	"vercel-ai-gateway": "VERCEL_AI_GATEWAY_API_KEY",
	jabberwock: "JABBERWOCK_API_KEY",
}

export function getEnvVarName(provider: SupportedProvider): string {
	return envVarMap[provider]
}

export function getApiKeyFromEnv(provider: SupportedProvider): string | undefined {
	const envVar = getEnvVarName(provider)
	return process.env[envVar]
}

interface ProviderFieldMapping {
	apiKeyField: keyof JabberwockSettings
	modelField: keyof JabberwockSettings
}

const PROVIDER_FIELD_MAP: Record<SupportedProvider, ProviderFieldMapping> = {
	anthropic: { apiKeyField: "apiKey", modelField: "apiModelId" },
	"openai-native": { apiKeyField: "openAiNativeApiKey", modelField: "apiModelId" },
	gemini: { apiKeyField: "geminiApiKey", modelField: "apiModelId" },
	openrouter: { apiKeyField: "openRouterApiKey", modelField: "openRouterModelId" },
	"vercel-ai-gateway": { apiKeyField: "vercelAiGatewayApiKey", modelField: "vercelAiGatewayModelId" },
	jabberwock: { apiKeyField: "jabberwockApiKey", modelField: "apiModelId" },
}

function setIfDefined<T extends object, K extends keyof T>(obj: T, key: K, value: T[K] | undefined): void {
	if (value !== undefined) {
		obj[key] = value
	}
}

export function getProviderSettings(
	provider: SupportedProvider,
	apiKey: string | undefined,
	model: string | undefined,
): JabberwockSettings {
	const config: JabberwockSettings = { apiProvider: provider }
	const mapping = PROVIDER_FIELD_MAP[provider]

	if (mapping) {
		setIfDefined(config, mapping.apiKeyField, apiKey)
		setIfDefined(config, mapping.modelField, model)
	} else {
		setIfDefined(config, "apiKey", apiKey)
		setIfDefined(config, "apiModelId", model)
	}

	return config
}
