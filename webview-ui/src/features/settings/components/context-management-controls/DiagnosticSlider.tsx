import { useAppTranslation } from "@/i18n/TranslationContext"
import { Button } from "@src/shared/ui/buttons/button"
import { Slider } from "@src/shared/ui/inputs/slider"
import { SearchableSetting } from "../shared/SearchableSetting"
import { SetCachedStateField } from "../shared/types"

type DiagnosticSliderProps = {
	maxDiagnosticMessages: number | undefined
	setCachedStateField: SetCachedStateField<"maxDiagnosticMessages">
}

function getSliderValue(diagnosticMessages: number | undefined): number {
	if (diagnosticMessages !== undefined && diagnosticMessages <= 0) {
		return 100
	}
	return diagnosticMessages ?? 50
}

function getSliderAriaValueNow(diagnosticMessages: number | undefined): number {
	return getSliderValue(diagnosticMessages)
}

function isUnlimited(diagnosticMessages: number | undefined): boolean {
	if (diagnosticMessages !== undefined && diagnosticMessages <= 0) {
		return true
	}
	return diagnosticMessages === 100
}

export const DiagnosticSlider = ({ maxDiagnosticMessages, setCachedStateField }: DiagnosticSliderProps) => {
	const { t } = useAppTranslation()

	const sliderValue = getSliderValue(maxDiagnosticMessages)
	const unlimited = isUnlimited(maxDiagnosticMessages)

	return (
		<SearchableSetting
			settingId="context-max-diagnostic-messages"
			section="contextManagement"
			label={t("settings:contextManagement.diagnostics.maxMessages.label")}>
			<span className="block font-medium mb-1">
				{t("settings:contextManagement.diagnostics.maxMessages.label")}
			</span>
			<div className="flex items-center gap-2">
				<Slider
					min={1}
					max={100}
					step={1}
					value={[sliderValue]}
					onValueChange={([value]) => {
						setCachedStateField("maxDiagnosticMessages", value === 100 ? -1 : value)
					}}
					data-testid="max-diagnostic-messages-slider"
					aria-label={t("settings:contextManagement.diagnostics.maxMessages.label")}
					aria-valuemin={1}
					aria-valuemax={100}
					aria-valuenow={getSliderAriaValueNow(maxDiagnosticMessages)}
					aria-valuetext={
						unlimited || maxDiagnosticMessages === 100
							? t("settings:contextManagement.diagnostics.maxMessages.unlimitedLabel")
							: `${maxDiagnosticMessages ?? 50} ${t("settings:contextManagement.diagnostics.maxMessages.label")}`
					}
				/>
				<span className="w-20 text-sm font-medium">
					{unlimited || maxDiagnosticMessages === 100
						? t("settings:contextManagement.diagnostics.maxMessages.unlimitedLabel")
						: (maxDiagnosticMessages ?? 50)}
				</span>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => setCachedStateField("maxDiagnosticMessages", 50)}
					title={t("settings:contextManagement.diagnostics.maxMessages.resetTooltip")}
					className="p-1 h-6 w-6"
					disabled={maxDiagnosticMessages === 50}>
					<span className="codicon codicon-discard" />
				</Button>
			</div>
			<div className="text-vscode-descriptionForeground text-sm mt-1">
				{t("settings:contextManagement.diagnostics.maxMessages.description")}
			</div>
		</SearchableSetting>
	)
}
