import React from "react"
import { Trans } from "react-i18next"
import { VSCodeLink, VSCodeTextArea } from "@vscode/webview-ui-toolkit/react"
import { Button } from "@src/shared/ui/buttons/button"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { buildDocLink } from "@/utils/misc/docLinks"
import { getEventValue } from "@src/utils/helpers/getEventValue"
import { rootStore } from "@src/features/store"
import type { ModeConfig, PromptComponent } from "../types"

interface CustomInstructionsSectionProps {
	visualMode: string
	customModes: ModeConfig[] | undefined
	customModePrompts: Record<string, PromptComponent | undefined> | undefined
	getCustomInstructionsVal: (s: string) => string
	handleCustomInstructionsChange: (v: string) => void
	handleAgentReset: (slug: string, type: "customInstructions") => void
	currentMode: ModeConfig | undefined
	currentModeName: string
	currentModeSlug: string
	isCustomMode: boolean | undefined
}

import { getPromptFieldValue } from "../utils"
export const CustomInstructionsSection: React.FC<CustomInstructionsSectionProps> = ({
	visualMode,
	customModes,
	customModePrompts,
	getCustomInstructionsVal,
	handleCustomInstructionsChange,
	handleAgentReset,
	currentMode,
	currentModeName,
	currentModeSlug,
	isCustomMode,
}) => {
	const { t } = useAppTranslation()
	return (
		<>
			<div className="mb-2">
				<div className="flex justify-between items-center mb-1">
					<div className="font-bold">{t("prompts:customInstructions.title")}</div>
					{!isCustomMode && (
						<StandardTooltip content={t("prompts:customInstructions.resetToDefault")}>
							<Button
								variant="ghost"
								size="icon"
								onClick={() => {
									if (currentMode?.slug) {
										handleAgentReset(currentMode.slug, "customInstructions")
									}
								}}
								data-testid="custom-instructions-reset">
								<span className="codicon codicon-discard" />
							</Button>
						</StandardTooltip>
					)}
				</div>
				<div className="text-[13px] text-vscode-descriptionForeground mb-2">
					{t("prompts:customInstructions.description", { modeName: currentModeName })}
				</div>
				<VSCodeTextArea
					resize="vertical"
					value={getPromptFieldValue(
						visualMode,
						"customInstructions",
						customModes,
						customModePrompts,
						getCustomInstructionsVal,
					)}
					onChange={(e) => {
						const value = getEventValue(e) ?? ""
						handleCustomInstructionsChange(value)
					}}
					rows={10}
					className="w-full"
					data-testid={`${currentModeSlug}-custom-instructions-textarea`}
				/>
				<div className="text-xs text-vscode-descriptionForeground mt-1.5">
					<Trans
						i18nKey="prompts:customInstructions.loadFromFile"
						values={{ mode: currentModeName, slug: currentModeSlug }}
						components={{
							span: (
								<span
									className="text-vscode-textLink-foreground cursor-pointer underline"
									onClick={() => {
										if (!currentMode) return
										rootStore.settings.openFile(
											`./.jabberwock/rules-${currentMode.slug}/rules.md`,
											{
												create: true,
												content: "",
											},
										)
									}}
								/>
							),
							"0": (
								<VSCodeLink
									href={buildDocLink(
										"features/custom-instructions#global-rules-directory",
										"prompts_mode_specific_global_rules",
									)}
									style={{ display: "inline" }}
									aria-label="Learn about global custom instructions for modes"
								/>
							),
						}}
					/>
				</div>
			</div>
			<div className="pb-4 border-b border-vscode-input-border">
				<div className="flex gap-2 mb-4">
					<Button
						variant="primary"
						onClick={() => {
							if (currentMode) {
								rootStore.settings.getSystemPrompt(currentMode.slug)
							}
						}}
						data-testid="preview-prompt-button">
						{t("prompts:systemPrompt.preview")}
					</Button>
					<StandardTooltip content={t("prompts:systemPrompt.copy")}>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => {
								if (currentMode) {
									rootStore.settings.copySystemPrompt(currentMode.slug)
								}
							}}
							data-testid="copy-prompt-button">
							<span className="codicon codicon-copy" />
						</Button>
					</StandardTooltip>
				</div>
			</div>
		</>
	)
}
