import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { Trans } from "react-i18next"
import { ChevronsUpDown, Info } from "lucide-react"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "@src/shared/ui/buttons/button"
import { Popover, PopoverTrigger } from "@src/shared/ui/overlays/popover"
import { ApiErrorMessage } from "../provider-controls/ApiErrorMessage"
import type { ModelPickerProps } from "./types"
import { useModelPicker } from "./useModelPicker"
import { PopoverContentInner } from "./PopoverContentInner"
import { ModelInfoSection } from "./ModelInfoSection"

export const ModelPicker = ({
	defaultModelId,
	models,
	modelIdKey,
	serviceName,
	serviceUrl,
	apiConfiguration,
	setApiConfigurationField,
	organizationAllowList,
	errorMessage,
	simplifySettings,
	hidePricing,
	label,
	valueTransform,
	displayTransform,
	onModelChange,
}: ModelPickerProps) => {
	const { t } = useAppTranslation()
	const {
		open,
		searchValue,
		setSearchValue,
		isDescriptionExpanded,
		setIsDescriptionExpanded,
		selectedModelId,
		selectedModelInfo,
		displayValue,
		modelIds,
		onSelect,
		onOpenChange,
		onClearSearch,
	} = useModelPicker(
		defaultModelId,
		models,
		modelIdKey,
		apiConfiguration,
		setApiConfigurationField,
		organizationAllowList,
		valueTransform,
		onModelChange,
		displayTransform,
	)
	return (
		<>
			<div>
				<label className="block font-medium mb-1">{label || t("settings:modelPicker.label")}</label>
				<Popover open={open} onOpenChange={onOpenChange}>
					<PopoverTrigger asChild>
						<Button
							variant="combobox"
							role="combobox"
							aria-expanded={open}
							className="w-full justify-between"
							data-testid="model-picker-button">
							<div className="truncate">{displayValue || t("settings:common.select")}</div>
							<ChevronsUpDown className="opacity-50" />
						</Button>
					</PopoverTrigger>
					<PopoverContentInner
						searchValue={searchValue}
						onClearSearch={onClearSearch}
						onSelect={onSelect}
						modelIds={modelIds}
						displayValue={displayValue}
						setSearchValue={setSearchValue}
					/>
				</Popover>
			</div>
			{errorMessage && <ApiErrorMessage errorMessage={errorMessage} />}
			{selectedModelInfo?.deprecated && (
				<ApiErrorMessage errorMessage={t("settings:validation.modelDeprecated")} />
			)}
			{simplifySettings ? (
				<p className="text-xs text-vscode-descriptionForeground m-0">
					<Info className="size-3 inline mr-1" />
					{t("settings:modelPicker.simplifiedExplanation")}
				</p>
			) : (
				<div>
					<ModelInfoSection
						selectedModelId={selectedModelId}
						selectedModelInfo={selectedModelInfo}
						apiConfiguration={apiConfiguration}
						isDescriptionExpanded={isDescriptionExpanded}
						setIsDescriptionExpanded={setIsDescriptionExpanded}
						hidePricing={hidePricing}
					/>
					{!hidePricing && (
						<div className="text-sm text-vscode-descriptionForeground">
							<Trans
								i18nKey="settings:modelPicker.automaticFetch"
								components={{
									serviceLink: <VSCodeLink href={serviceUrl} className="text-sm" />,
									defaultModelLink: (
										<VSCodeLink onClick={() => onSelect(defaultModelId)} className="text-sm" />
									),
								}}
								values={{ serviceName, defaultModelId }}
							/>
						</div>
					)}
				</div>
			)}
		</>
	)
}
