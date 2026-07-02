import React from "react"
import { VSCodeRadioGroup, VSCodeRadio } from "@vscode/webview-ui-toolkit/react"
import type { ModeSource } from "../types"
import { useAppTranslation } from "@src/i18n/TranslationContext"

interface SaveLocationSectionProps {
	newModeSource: ModeSource
	onSourceChange: (source: ModeSource) => void
}

export const SaveLocationSection: React.FC<SaveLocationSectionProps> = ({ newModeSource, onSourceChange }) => {
	const { t } = useAppTranslation()

	return (
		<div className="mb-4">
			<div className="font-bold mb-1">{t("prompts:createModeDialog.saveLocation.label")}</div>
			<div className="text-sm text-vscode-descriptionForeground mb-2">
				{t("prompts:createModeDialog.saveLocation.description")}
			</div>
			<VSCodeRadioGroup
				value={newModeSource}
				onChange={(e: Event | React.FormEvent<HTMLElement>) => {
					const target = ((e as CustomEvent)?.detail?.target ||
						(e.target as HTMLInputElement)) as HTMLInputElement
					onSourceChange(target.value as ModeSource)
				}}>
				<VSCodeRadio value="global">
					{t("prompts:createModeDialog.saveLocation.global.label")}
					<div className="text-xs text-vscode-descriptionForeground mt-0.5">
						{t("prompts:createModeDialog.saveLocation.global.description")}
					</div>
				</VSCodeRadio>
				<VSCodeRadio value="project">
					{t("prompts:createModeDialog.saveLocation.project.label")}
					<div className="text-xs text-vscode-descriptionForeground mt-0.5">
						{t("prompts:createModeDialog.saveLocation.project.description")}
					</div>
				</VSCodeRadio>
			</VSCodeRadioGroup>
		</div>
	)
}
