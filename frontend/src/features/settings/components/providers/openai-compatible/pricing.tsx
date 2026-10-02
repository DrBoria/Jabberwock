import type { ModelInfo } from "@jabberwock/types"
import { openAiModelInfoSaneDefaults } from "@jabberwock/types"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { getNonNegativeBorderColor } from "./types"
import { ModelInfoFields } from "./model"

export const CachePricingFields = ({
	customModelInfo,
	onModelInfoChange,
}: {
	customModelInfo: ModelInfo
	onModelInfoChange: (p: Partial<ModelInfo>) => void
}) => {
	const { t } = useAppTranslation()
	return (
		<ModelInfoFields
			onModelInfoChange={onModelInfoChange}
			fields={[
				{
					key: "cacheReadsPrice",
					value: (customModelInfo.cacheReadsPrice ?? 0).toString(),
					borderColor: getNonNegativeBorderColor(customModelInfo.cacheReadsPrice),
					parse: (raw) => parseFloat(raw),
					fallback: 0,
					placeholder: t("settings:placeholders.numbers.inputPrice"),
					label: t("settings:providers.customModel.pricing.cacheReads.label"),
					tooltip: t("settings:providers.customModel.pricing.cacheReads.description"),
				},
				{
					key: "cacheWritesPrice",
					value: (customModelInfo.cacheWritesPrice ?? 0).toString(),
					borderColor: getNonNegativeBorderColor(customModelInfo.cacheWritesPrice),
					parse: (raw) => parseFloat(raw),
					fallback: 0,
					placeholder: t("settings:placeholders.numbers.cacheWritePrice"),
					label: t("settings:providers.customModel.pricing.cacheWrites.label"),
					tooltip: t("settings:providers.customModel.pricing.cacheWrites.description"),
				},
			]}
		/>
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
			<ModelInfoFields
				onModelInfoChange={onModelInfoChange}
				fields={[
					{
						key: "inputPrice",
						value: (customModelInfo.inputPrice ?? openAiModelInfoSaneDefaults.inputPrice)?.toString() ?? "",
						borderColor: getNonNegativeBorderColor(customModelInfo.inputPrice),
						parse: (raw) => parseFloat(raw),
						fallback: openAiModelInfoSaneDefaults.inputPrice,
						placeholder: t("settings:placeholders.numbers.inputPrice"),
						label: t("settings:providers.customModel.pricing.input.label"),
						tooltip: t("settings:providers.customModel.pricing.input.description"),
					},
					{
						key: "outputPrice",
						value:
							(customModelInfo.outputPrice ?? openAiModelInfoSaneDefaults.outputPrice)?.toString() ?? "",
						borderColor: getNonNegativeBorderColor(customModelInfo.outputPrice),
						parse: (raw) => parseFloat(raw),
						fallback: openAiModelInfoSaneDefaults.outputPrice,
						placeholder: t("settings:placeholders.numbers.outputPrice"),
						label: t("settings:providers.customModel.pricing.output.label"),
						tooltip: t("settings:providers.customModel.pricing.output.description"),
					},
				]}
			/>
			{customModelInfo.supportsPromptCache && (
				<CachePricingFields customModelInfo={customModelInfo} onModelInfoChange={onModelInfoChange} />
			)}
		</>
	)
}
