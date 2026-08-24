import { useAppTranslation } from "@/i18n/TranslationContext"
import { cn } from "@/lib/utils"
import { SectionHeader } from "../shared/SectionHeader"
import { Section } from "../shared/Section"
import { DiagnosticSlider } from "../context-management-controls/DiagnosticSlider"
import { CondensePromptEditor } from "../context-management-controls/CondensePromptEditor"
import { AutoCondenseSettings } from "../context-management-controls/AutoCondenseSettings"
import type { ContextManagementSettingsProps, ContextManagementCachedField } from "./types"
import { SliderSettings } from "./SliderSettings"
import { CheckboxFields } from "./CheckboxFields"
import { ImageSizeSettings } from "./ImageSizeSettings"

export const ContextManagementSettings = ({
	autoCondenseContext,
	autoCondenseContextPercent,
	listApiConfigMeta,
	maxOpenTabsContext,
	maxWorkspaceFiles,
	showJabberwockIgnoredFiles,
	enableSubfolderRules,
	setCachedStateField,
	maxImageFileSize,
	maxTotalImageSize,
	profileThresholds = {},
	includeDiagnosticMessages,
	maxDiagnosticMessages,
	writeDelayMs,
	includeCurrentTime,
	includeCurrentCost,
	maxGitStatusFiles,
	customSupportPrompts,
	setCustomSupportPrompts,
	className,
	...props
}: ContextManagementSettingsProps) => {
	const { t } = useAppTranslation()
	const handleSliderChange = (field: string, value: number) =>
		setCachedStateField(field as ContextManagementCachedField, value)
	const handleCheckboxChange = (field: ContextManagementCachedField, value: boolean) =>
		setCachedStateField(field, value)

	return (
		<div className={cn("flex flex-col gap-2", className)} {...props}>
			<SectionHeader description={t("settings:contextManagement.description")}>
				{t("settings:sections.contextManagement")}
			</SectionHeader>

			<Section>
				<SliderSettings
					maxOpenTabsContext={maxOpenTabsContext}
					maxWorkspaceFiles={maxWorkspaceFiles}
					maxGitStatusFiles={maxGitStatusFiles ?? 0}
					writeDelayMs={writeDelayMs}
					onChange={handleSliderChange}
				/>

				<CheckboxFields
					showJabberwockIgnoredFiles={showJabberwockIgnoredFiles}
					enableSubfolderRules={enableSubfolderRules}
					includeDiagnosticMessages={includeDiagnosticMessages}
					includeCurrentTime={includeCurrentTime}
					includeCurrentCost={includeCurrentCost}
					onChange={handleCheckboxChange}
				/>

				<ImageSizeSettings
					maxImageFileSize={maxImageFileSize}
					maxTotalImageSize={maxTotalImageSize}
					onChange={handleSliderChange}
				/>

				<DiagnosticSlider
					maxDiagnosticMessages={maxDiagnosticMessages}
					setCachedStateField={setCachedStateField}
				/>
			</Section>
			<Section className="pt-2">
				<CondensePromptEditor
					customSupportPrompts={customSupportPrompts}
					setCustomSupportPrompts={setCustomSupportPrompts}
				/>
				<AutoCondenseSettings
					autoCondenseContext={autoCondenseContext}
					autoCondenseContextPercent={autoCondenseContextPercent}
					listApiConfigMeta={listApiConfigMeta}
					profileThresholds={profileThresholds}
					setCachedStateField={setCachedStateField}
				/>
			</Section>
		</div>
	)
}
