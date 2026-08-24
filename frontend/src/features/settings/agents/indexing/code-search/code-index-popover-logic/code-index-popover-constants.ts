import type { CodebaseIndexConfig } from "@jabberwock/types"
import { CODEBASE_INDEX_DEFAULTS } from "@jabberwock/types"
import type { LocalCodeIndexSettings } from "./code-index-popover-types"

export const DEFAULT_QDRANT_URL = "http://localhost:6333"
export const SECRET_PLACEHOLDER = "••••••••••••••••"

export interface SecretStatus {
	hasOpenAiKey: boolean
	hasQdrantApiKey: boolean
	hasOpenAiCompatibleApiKey: boolean
	hasGeminiApiKey: boolean
	hasMistralApiKey: boolean
	hasVercelAiGatewayApiKey: boolean
	hasOpenRouterApiKey: boolean
}
export interface SecretMapping {
	key: keyof LocalCodeIndexSettings
	hasKey: keyof SecretStatus
}

export const SECRET_MAPPINGS: SecretMapping[] = [
	{ key: "codeIndexOpenAiKey", hasKey: "hasOpenAiKey" },
	{ key: "codeIndexQdrantApiKey", hasKey: "hasQdrantApiKey" },
	{ key: "codebaseIndexOpenAiCompatibleApiKey", hasKey: "hasOpenAiCompatibleApiKey" },
	{ key: "codebaseIndexGeminiApiKey", hasKey: "hasGeminiApiKey" },
	{ key: "codebaseIndexMistralApiKey", hasKey: "hasMistralApiKey" },
	{ key: "codebaseIndexVercelAiGatewayApiKey", hasKey: "hasVercelAiGatewayApiKey" },
	{ key: "codebaseIndexOpenRouterApiKey", hasKey: "hasOpenRouterApiKey" },
]

export const SECRET_PLACEHOLDER_FIELDS = new Set<keyof LocalCodeIndexSettings | string>(
	SECRET_MAPPINGS.map((m) => m.key),
)

export const updateWithSecrets = (prev: LocalCodeIndexSettings, secretStatus: SecretStatus): LocalCodeIndexSettings => {
	const updated = { ...prev }
	for (const { key, hasKey } of SECRET_MAPPINGS) {
		const value = prev[key as keyof LocalCodeIndexSettings]
		if (!value || value === SECRET_PLACEHOLDER) {
			Object.assign(updated, { [key]: secretStatus[hasKey] ? SECRET_PLACEHOLDER : "" })
		}
	}
	return updated
}

export const orStr = (value: string | null | undefined, defaultVal = ""): string => value || defaultVal
export const orNum = (value: number | null | undefined, defaultVal: number): number => value ?? defaultVal
export const orBool = (value: boolean | null | undefined, defaultVal: boolean): boolean => value ?? defaultVal

export const STATUS_COLORS: Record<string, string> = {
	Standby: "bg-gray-400",
	Indexing: "bg-yellow-500 animate-pulse",
	Indexed: "bg-green-500",
	Error: "bg-red-500",
}

export const buildInitialSettings = (config: CodebaseIndexConfig): LocalCodeIndexSettings => ({
	codebaseIndexEnabled: orBool(config.codebaseIndexEnabled, true),
	codebaseIndexQdrantUrl: orStr(config.codebaseIndexQdrantUrl),
	codebaseIndexEmbedderProvider: config.codebaseIndexEmbedderProvider ?? "openai",
	codebaseIndexEmbedderBaseUrl: orStr(config.codebaseIndexEmbedderBaseUrl),
	codebaseIndexEmbedderModelId: orStr(config.codebaseIndexEmbedderModelId),
	codebaseIndexEmbedderModelDimension: config.codebaseIndexEmbedderModelDimension ?? undefined,
	codebaseIndexSearchMaxResults: orNum(
		config.codebaseIndexSearchMaxResults,
		CODEBASE_INDEX_DEFAULTS.DEFAULT_SEARCH_RESULTS,
	),
	codebaseIndexSearchMinScore: orNum(
		config.codebaseIndexSearchMinScore,
		CODEBASE_INDEX_DEFAULTS.DEFAULT_SEARCH_MIN_SCORE,
	),
	codebaseIndexBedrockRegion: orStr(config.codebaseIndexBedrockRegion),
	codebaseIndexBedrockProfile: orStr(config.codebaseIndexBedrockProfile),
	codeIndexOpenAiKey: "",
	codeIndexQdrantApiKey: "",
	codebaseIndexOpenAiCompatibleBaseUrl: orStr(config.codebaseIndexOpenAiCompatibleBaseUrl),
	codebaseIndexOpenAiCompatibleApiKey: "",
	codebaseIndexGeminiApiKey: "",
	codebaseIndexMistralApiKey: "",
	codebaseIndexVercelAiGatewayApiKey: "",
	codebaseIndexOpenRouterApiKey: "",
	codebaseIndexOpenRouterSpecificProvider: orStr(config.codebaseIndexOpenRouterSpecificProvider),
})
