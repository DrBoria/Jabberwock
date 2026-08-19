import type { ModelInfo } from "@jabberwock/types"
import { openAiModelInfoSaneDefaults } from "@jabberwock/types"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { getEventValue, getNonNegativeBorderColor } from "./types"
import { ModelNumericField } from "./model-sections"

export const CachePricingFields = ({
	customModelInfo,
	onModelInfoChange,
}: {
	customModelInfo: ModelInfo
	onModelInfoChange: (p: Partial<ModelInfo>) => void
}) => {
	const { t } = useAppTranslation()
	return (
		<>
			<ModelNumericField
				value={(customModelInfo.cacheReadsPrice ?? 0).toString()}
				borderColor={getNonNegativeBorderColor(customModelInfo.cacheReadsPrice)}
				onChange={(e) => {
					const v = parseFloat(getEventValue(e))
					onModelInfoChange({ cacheReadsPrice: isNaN(v) ? 0 : v })
				}}
				placeholder={t("settings:placeholders.numbers.inputPrice")}
				label={t("settings:providers.customModel.pricing.cacheReads.label")}
				tooltip={t("settings:providers.customModel.pricing.cacheReads.description")}
			/>
			<ModelNumericField
				value={(customModelInfo.cacheWritesPrice ?? 0).toString()}
				borderColor={getNonNegativeBorderColor(customModelInfo.cacheWritesPrice)}
				onChange={(e) => {
					const v = parseFloat(getEventValue(e))
					onModelInfoChange({ cacheWritesPrice: isNaN(v) ? 0 : v })
				}}
				placeholder={t("settings:placeholders.numbers.cacheWritePrice")}
				label={t("settings:providers.customModel.pricing.cacheWrites.label")}
				tooltip={t("settings:providers.customModel.pricing.cacheWrites.description")}
			/>
		</>
	)
}

export const ModelPricingFields = ({
	customModelInfo,
	onModelInfoChange,
}: {
	customModelInfo: ModelInfo
	onModelInfoChange: (p: Partial<ModelInfo>) => void
}) => {
	const { t } = useAppTranslation()
	return (
		<>
			<ModelNumericField
				value={(customModelInfo.inputPrice ?? openAiModelInfoSaneDefaults.inputPrice)?.toString() ?? ""}
				borderColor={getNonNegativeBorderColor(customModelInfo.inputPrice)}
				onChange={(e) => {
					const v = parseFloat(getEventValue(e))
					onModelInfoChange({ inputPrice: isNaN(v) ? openAiModelInfoSaneDefaults.inputPrice : v })
				}}
				placeholder={t("settings:placeholders.numbers.inputPrice")}
				label={t("settings:providers.customModel.pricing.input.label")}
				tooltip={t("settings:providers.customModel.pricing.input.description")}
			/>
			<ModelNumericField
				value={(customModelInfo.outputPrice ?? openAiModelInfoSaneDefaults.outputPrice)?.toString() ?? ""}
				borderColor={getNonNegativeBorderColor(customModelInfo.outputPrice)}
				onChange={(e) => {
					const v = parseFloat(getEventValue(e))
					onModelInfoChange({ outputPrice: isNaN(v) ? openAiModelInfoSaneDefaults.outputPrice : v })
				}}
				placeholder={t("settings:placeholders.numbers.outputPrice")}
				label={t("settings:providers.customModel.pricing.output.label")}
				tooltip={t("settings:providers.customModel.pricing.output.description")}
			/>
			{customModelInfo.supportsPromptCache && (
				<CachePricingFields customModelInfo={customModelInfo} onModelInfoChange={onModelInfoChange} />
			)}
		</>
	)
}
