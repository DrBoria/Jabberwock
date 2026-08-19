import type { ModelInfo, ServiceTier } from "@jabberwock/types"

export type ModelInfoViewProps = {
	apiProvider?: string
	selectedModelId: string
	modelInfo?: ModelInfo
	isDescriptionExpanded: boolean
	setIsDescriptionExpanded: (isExpanded: boolean) => void
	hidePricing?: boolean
}

export type TierPricingTableProps = { modelInfo?: ModelInfo; allowedTierNames: ServiceTier[] }

export type TFunc = (key: string, options?: Record<string, unknown>) => string
