import React from "react"
import type { ModeConfig, ToolGroup, PromptComponent } from "../types"
import { ToolsSection } from "../components"
import { PromptFieldSection } from "./prompt-field-section"
import { CustomInstructionsSection } from "./custom-instructions"
import { getPromptFieldValue } from "../utils"
import { useAppTranslation } from "@src/i18n/TranslationContext"

type ConfigSectionProps = {
	visualMode: string
	customModes: ModeConfig[] | undefined
	isToolsEditMode: boolean
	isCustomMode: boolean | undefined
	currentMode: ModeConfig | undefined
	currentModeName: string
	currentModeSlug: string
	customModePrompts: Record<string, PromptComponent | undefined> | undefined
	handleRoleDefinitionChange: (v: string) => void
	handleDescriptionChange: (v: string) => void
	handleWhenToUseChange: (v: string) => void
	handleCustomInstructionsChange: (v: string) => void
	handleAgentReset: (
		slug: string,
		type: "roleDefinition" | "description" | "whenToUse" | "customInstructions",
	) => void
	handleGroupChangeForTool: (group: ToolGroup, checked: boolean) => void
	getCurrentMode: () => ModeConfig | undefined
	getRoleDefinitionVal: (s: string) => string
	getDescriptionVal: (s: string) => string
	getWhenToUseVal: (s: string) => string
	getCustomInstructionsVal: (s: string) => string
	setIsToolsEditMode: (v: boolean) => void
}

export const ConfigSection: React.FC<ConfigSectionProps> = ({
	visualMode,
	customModes,
	isToolsEditMode,
	isCustomMode,
	currentMode,
	currentModeName,
	currentModeSlug,
	customModePrompts,
	handleRoleDefinitionChange,
	handleDescriptionChange,
	handleWhenToUseChange,
	handleCustomInstructionsChange,
	handleAgentReset,
	handleGroupChangeForTool,
	getCurrentMode,
	getRoleDefinitionVal,
	getDescriptionVal,
	getWhenToUseVal,
	getCustomInstructionsVal,
	setIsToolsEditMode,
}) => {
	const { t } = useAppTranslation()

	return (
		<>
			<PromptFieldSection
				label={t("prompts:roleDefinition.title")}
				description={t("prompts:roleDefinition.description")}
				isCustomMode={!!isCustomMode}
				value={getPromptFieldValue(
					visualMode,
					"roleDefinition",
					customModes,
					customModePrompts,
					getRoleDefinitionVal,
				)}
				isTextArea
				rows={5}
				testId={`${currentModeSlug}-prompt-textarea`}
				onChange={handleRoleDefinitionChange}
				onReset={() => {
					if (currentMode?.slug) {
						handleAgentReset(currentMode.slug, "roleDefinition")
					}
				}}
			/>

			<PromptFieldSection
				label={t("prompts:description.title")}
				description={t("prompts:description.description")}
				isCustomMode={!!isCustomMode}
				value={getPromptFieldValue(
					visualMode,
					"description",
					customModes,
					customModePrompts,
					getDescriptionVal,
				)}
				testId={`${currentModeSlug}-description-textfield`}
				onChange={handleDescriptionChange}
				onReset={() => {
					if (currentMode?.slug) {
						handleAgentReset(currentMode.slug, "description")
					}
				}}
			/>

			<PromptFieldSection
				label={t("prompts:whenToUse.title")}
				description={t("prompts:whenToUse.description")}
				isCustomMode={!!isCustomMode}
				value={getPromptFieldValue(visualMode, "whenToUse", customModes, customModePrompts, getWhenToUseVal)}
				isTextArea
				rows={4}
				testId={`${currentModeSlug}-when-to-use-textarea`}
				onChange={handleWhenToUseChange}
				onReset={() => {
					if (currentMode?.slug) {
						handleAgentReset(currentMode.slug, "whenToUse")
					}
				}}
			/>

			<ToolsSection
				visualMode={visualMode}
				customModes={customModes}
				isToolsEditMode={isToolsEditMode}
				getCurrentMode={getCurrentMode}
				onToggleEditMode={() => setIsToolsEditMode(!isToolsEditMode)}
				onGroupChange={handleGroupChangeForTool}
			/>

			<CustomInstructionsSection
				visualMode={visualMode}
				customModes={customModes}
				customModePrompts={customModePrompts}
				getCustomInstructionsVal={getCustomInstructionsVal}
				handleCustomInstructionsChange={handleCustomInstructionsChange}
				handleAgentReset={handleAgentReset}
				currentMode={currentMode}
				currentModeName={currentModeName}
				currentModeSlug={currentModeSlug}
				isCustomMode={isCustomMode}
			/>
		</>
	)
}
