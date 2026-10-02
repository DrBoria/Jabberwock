import { useCallback } from "react"
import { Checkbox } from "vscrui"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import type { ModelInfo } from "@jabberwock/types"
import { openAiModelInfoSaneDefaults } from "@jabberwock/types"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard"
import { Button } from "@src/shared/ui/buttons/button-primitive"
import type { OpenAICompatibleProps, InputEvent } from "./types"
import { getEventValue, getPositiveBorderColor } from "./types"
import { ModelPricingFields } from "./pricing"

export const ModelNumericField = ({
	label,
	description,
	tooltip,
	placeholder,
	value,
	borderColor,
	onChange,
	dataTestId,
}: {
	label: string
	description?: string
	tooltip?: string
	placeholder: string
	value: string
	borderColor: string
	onChange: (e: InputEvent) => void
	dataTestId?: string
}) => (
	<div>
		<VSCodeTextField
			value={value}
			type="text"
			style={{ borderColor }}
			onChange={onChange}
			placeholder={placeholder}
			data-testid={dataTestId}
			className="w-full">
			{tooltip ? (
				<div className="flex items-center gap-1">
					<label className="block font-medium mb-1">{label}</label>
					<StandardTooltip content={tooltip}>
						<i
							className="codicon codicon-info text-vscode-descriptionForeground"
							style={{ fontSize: "12px" }}
						/>
					</StandardTooltip>
				</div>
			) : (
				<label className="block font-medium mb-1">{label}</label>
			)}
		</VSCodeTextField>
		{description && <div className="text-sm text-vscode-descriptionForeground">{description}</div>}
	</div>
)

/**
 * A single numeric ModelInfo field descriptor. `ModelInfoFields` renders one
 * `ModelNumericField` per entry, so the token and pricing panels share the
 * same binding logic (parse → fallback → write) instead of each re-implementing
 * it (see `local/no-duplicated-logic`).
 */
export interface ModelInfoFieldConfig {
	key: "maxTokens" | "contextWindow" | "inputPrice" | "outputPrice" | "cacheReadsPrice" | "cacheWritesPrice"
	value: string
	borderColor: string
	parse: (raw: string) => number
	fallback: number | undefined
	placeholder: string
	label: string
	description?: string
	tooltip?: string
	dataTestId?: string
}

export const ModelInfoFields = ({
	onModelInfoChange,
	fields,
}: {
	onModelInfoChange: (p: Partial<ModelInfo>) => void
	fields: ModelInfoFieldConfig[]
}) => (
	<>
		{fields.map((field) => (
			<ModelNumericField
				key={field.key}
				value={field.value}
				borderColor={field.borderColor}
				onChange={(e) => {
					const v = field.parse(getEventValue(e))
					onModelInfoChange({ [field.key]: isNaN(v) ? field.fallback : v } as Partial<ModelInfo>)
				}}
				placeholder={field.placeholder}
				label={field.label}
				description={field.description}
				tooltip={field.tooltip}
				dataTestId={field.dataTestId}
			/>
		))}
	</>
)

export const ModelTokenFields = ({
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
					key: "maxTokens",
					value: (customModelInfo.maxTokens ?? openAiModelInfoSaneDefaults.maxTokens)?.toString() ?? "",
					borderColor: getPositiveBorderColor(customModelInfo.maxTokens),
					parse: (raw) => parseInt(raw, 10),
					fallback: undefined,
					placeholder: t("settings:placeholders.numbers.maxTokens"),
					label: t("settings:providers.customModel.maxTokens.label"),
					description: t("settings:providers.customModel.maxTokens.description"),
					dataTestId: "custom-model-max-tokens",
				},
				{
					key: "contextWindow",
					value:
						(customModelInfo.contextWindow ?? openAiModelInfoSaneDefaults.contextWindow)?.toString() ?? "",
					borderColor: getPositiveBorderColor(customModelInfo.contextWindow),
					parse: (raw) => parseInt(raw, 10),
					fallback: openAiModelInfoSaneDefaults.contextWindow,
					placeholder: t("settings:placeholders.numbers.contextWindow"),
					label: t("settings:providers.customModel.contextWindow.label"),
					description: t("settings:providers.customModel.contextWindow.description"),
					dataTestId: "custom-model-context-window",
				},
			]}
		/>
	)
}

const InfoIcon = ({ tooltip }: { tooltip: string }) => (
	<StandardTooltip content={tooltip}>
		<i className="codicon codicon-info text-vscode-descriptionForeground" style={{ fontSize: "12px" }} />
	</StandardTooltip>
)

const CapabilityCheckbox = ({
	checked,
	onChange,
	label,
	tooltip,
	description,
	dataTestId,
}: {
	checked: boolean
	onChange: (c: boolean) => void
	label: string
	tooltip: string
	description: string
	dataTestId?: string
}) => (
	<div>
		<div className="flex items-center gap-1">
			<Checkbox data-testid={dataTestId} checked={checked} onChange={onChange}>
				<span className="font-medium">{label}</span>
			</Checkbox>
			<InfoIcon tooltip={tooltip} />
		</div>
		<div className="text-sm text-vscode-descriptionForeground pt-1">{description}</div>
	</div>
)

export const ModelCapabilityCheckboxes = ({
	customModelInfo,
	onModelInfoChange,
}: {
	customModelInfo: ModelInfo
	onModelInfoChange: (p: Partial<ModelInfo>) => void
}) => {
	const { t } = useAppTranslation()
	return (
		<>
			<CapabilityCheckbox
				checked={customModelInfo.supportsImages ?? openAiModelInfoSaneDefaults.supportsImages ?? false}
				onChange={(c: boolean) => onModelInfoChange({ supportsImages: c })}
				label={t("settings:providers.customModel.imageSupport.label")}
				tooltip={t("settings:providers.customModel.imageSupport.description")}
				description={t("settings:providers.customModel.imageSupport.description")}
			/>
			<CapabilityCheckbox
				checked={customModelInfo.supportsPromptCache ?? false}
				onChange={(c: boolean) => onModelInfoChange({ supportsPromptCache: c })}
				label={t("settings:providers.customModel.promptCache.label")}
				tooltip={t("settings:providers.customModel.promptCache.description")}
				description={t("settings:providers.customModel.promptCache.description")}
				dataTestId="custom-model-prompt-cache"
			/>
		</>
	)
}

export const ModelCapabilitiesSection = ({
	apiConfiguration,
	setApiConfigurationField,
}: {
	apiConfiguration: { openAiCustomModelInfo?: ModelInfo }
	setApiConfigurationField: OpenAICompatibleProps["setApiConfigurationField"]
}) => {
	const { t } = useAppTranslation()
	const customModelInfo = apiConfiguration.openAiCustomModelInfo ?? openAiModelInfoSaneDefaults
	const handleModelInfoChange = useCallback(
		(partial: Partial<ModelInfo>) =>
			setApiConfigurationField("openAiCustomModelInfo", { ...customModelInfo, ...partial }),
		[setApiConfigurationField, customModelInfo],
	)
	return (
		<div className="flex flex-col gap-3">
			<div className="text-sm text-vscode-descriptionForeground whitespace-pre-line">
				{t("settings:providers.customModel.capabilities")}
			</div>
			<ModelTokenFields customModelInfo={customModelInfo} onModelInfoChange={handleModelInfoChange} />
			<ModelCapabilityCheckboxes customModelInfo={customModelInfo} onModelInfoChange={handleModelInfoChange} />
			<ModelPricingFields customModelInfo={customModelInfo} onModelInfoChange={handleModelInfoChange} />
			<Button
				variant="secondary"
				onClick={() => setApiConfigurationField("openAiCustomModelInfo", openAiModelInfoSaneDefaults)}>
				{t("settings:providers.customModel.resetDefaults")}
			</Button>
		</div>
	)
}
