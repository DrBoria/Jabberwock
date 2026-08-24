import { AnthropicModelId, anthropicModels } from "@jabberwock/types"

export function get1MContextTier(info: (typeof anthropicModels)[AnthropicModelId]):
	| {
			contextWindow: number
			inputPrice: number
			outputPrice: number
			cacheWritesPrice: number
			cacheReadsPrice: number
	  }
	| undefined {
	const tier = (
		info as {
			tiers?: Array<{
				contextWindow: number
				inputPrice: number
				outputPrice: number
				cacheWritesPrice: number
				cacheReadsPrice: number
			}>
		}
	).tiers?.[0]
	return tier
}
