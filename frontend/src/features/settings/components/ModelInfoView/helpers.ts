import type { ModelInfo, ServiceTier } from "@jabberwock/types"

export const hasValidContextWindow = (mi: ModelInfo | undefined): boolean =>
	typeof mi?.contextWindow === "number" && mi.contextWindow > 0

export const hasValidMaxTokens = (mi: ModelInfo | undefined): boolean =>
	typeof mi?.maxTokens === "number" && mi.maxTokens > 0

export const getSupportsImages = (mi: ModelInfo | undefined): boolean => mi?.supportsImages ?? false

export const getSupportsPromptCache = (mi: ModelInfo | undefined): boolean => mi?.supportsPromptCache ?? false

export const hasCacheReadsPrice = (mi: ModelInfo | undefined): boolean =>
	!!(mi?.supportsPromptCache && mi.cacheReadsPrice)

export const hasCacheWritesPrice = (mi: ModelInfo | undefined): boolean =>
	!!(mi?.supportsPromptCache && mi.cacheWritesPrice)

export const getCacheReadsPriceOrDefault = (mi: ModelInfo | undefined): number => mi?.cacheReadsPrice ?? 0

export const getCacheWritesPriceOrDefault = (mi: ModelInfo | undefined): number => mi?.cacheWritesPrice ?? 0

export const isTierFlexOrPriority = (tier: { name?: string }): boolean =>
	tier.name === "flex" || tier.name === "priority"

export const isDefined = (name: string | undefined): name is ServiceTier => name !== undefined

export const isOpenaiNativeWithTiers = (apiProvider: string | undefined, allowedTierNames: ServiceTier[]): boolean =>
	apiProvider === "openai-native" && allowedTierNames.length > 0

export const getFilteredTierNames = (modelInfo: ModelInfo | undefined): ServiceTier[] =>
	modelInfo?.tiers
		?.filter(isTierFlexOrPriority)
		?.map((t) => t.name)
		.filter(isDefined) ?? []
