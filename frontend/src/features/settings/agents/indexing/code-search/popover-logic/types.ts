import type { IndexingStatus, EmbedderProvider, EmbeddingModelProfiles } from "@jabberwock/types"

export interface CodeIndexPopoverProps {
	children: React.ReactNode
	indexingStatus: IndexingStatus
}

export interface LocalCodeIndexSettings {
	// Global state settings
	codebaseIndexEnabled: boolean
	codebaseIndexQdrantUrl: string
	codebaseIndexEmbedderProvider: EmbedderProvider
	codebaseIndexEmbedderBaseUrl?: string
	codebaseIndexEmbedderModelId: string
	codebaseIndexEmbedderModelDimension?: number
	codebaseIndexSearchMaxResults?: number
	codebaseIndexSearchMinScore?: number

	// Bedrock-specific settings
	codebaseIndexBedrockRegion?: string
	codebaseIndexBedrockProfile?: string

	// Secret settings (start empty, will be loaded separately)
	codeIndexOpenAiKey?: string
	codeIndexQdrantApiKey?: string
	codebaseIndexOpenAiCompatibleBaseUrl?: string
	codebaseIndexOpenAiCompatibleApiKey?: string
	codebaseIndexGeminiApiKey?: string
	codebaseIndexMistralApiKey?: string
	codebaseIndexVercelAiGatewayApiKey?: string
	codebaseIndexOpenRouterApiKey?: string
	codebaseIndexOpenRouterSpecificProvider?: string
}

export interface CodeIndexFormProps {
	currentSettings: LocalCodeIndexSettings
	formErrors: Record<string, string>
	updateSetting: (key: keyof LocalCodeIndexSettings, value: unknown) => void
	getAvailableModels: () => string[]
	codebaseIndexModels: EmbeddingModelProfiles | undefined
	t: (key: string, options?: Record<string, unknown>) => string
}
