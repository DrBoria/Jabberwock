import { useAppTranslation } from "@src/i18n/TranslationContext"
import { ModelDescriptionMarkdown } from "../provider-controls/ModelDescriptionMarkdown"
import { getFilteredTierNames, isOpenaiNativeWithTiers } from "./helpers"
import { TierPricingTable } from "./TierPricingTable"
import { getBaseInfoItems, getPriceInfoItems } from "./infoItems"
import type { ModelInfoViewProps } from "./types"

export const ModelInfoView = ({
	apiProvider,
	selectedModelId,
	modelInfo,
	isDescriptionExpanded,
	setIsDescriptionExpanded,
	hidePricing,
}: ModelInfoViewProps) => {
	const { t } = useAppTranslation()
	const allowedTierNames = getFilteredTierNames(modelInfo)
	const shouldShowTierPricingTable = isOpenaiNativeWithTiers(apiProvider, allowedTierNames)
	const showTierPricingTable = shouldShowTierPricingTable && !hidePricing
	const hasDescription = !!modelInfo?.description
	const baseInfoItems = getBaseInfoItems(modelInfo, apiProvider, selectedModelId, t)
	const priceInfoItems = getPriceInfoItems(modelInfo, t)
	const infoItems = shouldShowTierPricingTable || hidePricing ? baseInfoItems : [...baseInfoItems, ...priceInfoItems]
	return (
		<>
			{hasDescription && (
				<ModelDescriptionMarkdown
					markdown={modelInfo.description}
					isExpanded={isDescriptionExpanded}
					setIsExpanded={setIsDescriptionExpanded}
				/>
			)}
			<div className="text-sm text-vscode-descriptionForeground">
				{infoItems.map((item, index) => (
					<div key={index}>{item}</div>
				))}
			</div>
			{showTierPricingTable && <TierPricingTable modelInfo={modelInfo} allowedTierNames={allowedTierNames} />}
		</>
	)
}
