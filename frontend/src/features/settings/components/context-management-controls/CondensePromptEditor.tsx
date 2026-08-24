import { VSCodeTextArea } from "@vscode/webview-ui-toolkit/react"

import { supportPrompt } from "@shared/support-prompt"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { getEventValue } from "@src/utils/helpers/getEventValue"
import { Button } from "@src/shared/ui/buttons/button"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"
import { SearchableSetting } from "../shared/SearchableSetting"

type CondensePromptEditorProps = {
	customSupportPrompts: Record<string, string | undefined>
	setCustomSupportPrompts: (prompts: Record<string, string | undefined>) => void
}

export const CondensePromptEditor = ({ customSupportPrompts, setCustomSupportPrompts }: CondensePromptEditorProps) => {
	const { t } = useAppTranslation()

	const updateCondensePrompt = (value: string | undefined) => {
		const updatedPrompts = { ...customSupportPrompts }
		if (value === undefined) {
			delete updatedPrompts["CONDENSE"]
		} else {
			updatedPrompts["CONDENSE"] = value
		}
		setCustomSupportPrompts(updatedPrompts)
	}

	const handleCondenseReset = () => {
		const updatedPrompts = { ...customSupportPrompts }
		delete updatedPrompts["CONDENSE"]
		setCustomSupportPrompts(updatedPrompts)
	}

	const condensePromptValue = supportPrompt.get(customSupportPrompts, "CONDENSE")

	return (
		<SearchableSetting
			settingId="context-condense-prompt"
			section="contextManagement"
			label={t("prompts:supportPrompts.types.CONDENSE.label")}>
			<div className="flex justify-between items-center mb-1">
				<label className="block font-medium">{t("prompts:supportPrompts.types.CONDENSE.label")}</label>
				<StandardTooltip content={t("prompts:supportPrompts.resetPrompt", { promptType: "CONDENSE" })}>
					<Button variant="ghost" size="icon" onClick={handleCondenseReset}>
						<span className="codicon codicon-discard"></span>
					</Button>
				</StandardTooltip>
			</div>
			<div className="text-sm text-vscode-descriptionForeground mb-2">
				{t("prompts:supportPrompts.types.CONDENSE.description")}
			</div>
			<VSCodeTextArea
				resize="vertical"
				value={condensePromptValue}
				onInput={(e) => {
					const value = getEventValue(e) ?? ""
					updateCondensePrompt(value)
				}}
				rows={6}
				className="w-full"
				data-testid="condense-prompt-textarea"
			/>
		</SearchableSetting>
	)
}
