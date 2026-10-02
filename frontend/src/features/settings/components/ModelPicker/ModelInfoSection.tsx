import { ModelInfoView } from "@src/features/settings/components/ModelInfoView/main"
import type { ModelInfoSectionProps } from "./types"

export const ModelInfoSection: React.FC<ModelInfoSectionProps> = ({
	selectedModelId,
	selectedModelInfo,
	apiConfiguration,
	isDescriptionExpanded,
	setIsDescriptionExpanded,
	hidePricing,
}) =>
	!selectedModelId || !selectedModelInfo || selectedModelInfo.deprecated ? null : (
		<ModelInfoView
			apiProvider={apiConfiguration.apiProvider}
			selectedModelId={selectedModelId}
			modelInfo={selectedModelInfo}
			isDescriptionExpanded={isDescriptionExpanded}
			setIsDescriptionExpanded={setIsDescriptionExpanded}
			hidePricing={hidePricing}
		/>
	)
