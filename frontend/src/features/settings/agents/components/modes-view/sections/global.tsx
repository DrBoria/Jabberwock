import React from "react"
import { Trans } from "react-i18next"
import { VSCodeLink, VSCodeTextArea } from "@vscode/webview-ui-toolkit/react"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { buildDocLink } from "@/utils/misc/docLinks"
import { rootStore } from "@src/features/store"
import { getEventValue } from "@src/utils/helpers/getEventValue"

type GlobalSectionProps = {
	customInstructions: string | undefined
}

export const GlobalSection: React.FC<GlobalSectionProps> = ({ customInstructions }) => {
	const { t } = useAppTranslation()

	return (
		<div className="pb-5">
			<h3 className="text-vscode-foreground mb-3">{t("prompts:globalCustomInstructions.title")}</h3>
			<div className="text-sm text-vscode-descriptionForeground mb-2">
				<Trans i18nKey="prompts:globalCustomInstructions.description">
					<VSCodeLink
						href={buildDocLink(
							"features/custom-instructions#setting-up-global-rules",
							"prompts_global_custom_instructions",
						)}
						style={{ display: "inline" }}
						aria-label="Learn more about global custom instructions"
					/>
				</Trans>
			</div>
			<VSCodeTextArea
				resize="vertical"
				value={customInstructions || ""}
				onChange={(e) => {
					const value = getEventValue(e) ?? ""
					rootStore.setCustomInstructions(value ?? undefined)
				}}
				rows={4}
				className="w-full"
				data-testid="global-custom-instructions-textarea"
			/>
			<div className="text-xs text-vscode-descriptionForeground mt-1.5">
				<Trans
					i18nKey="prompts:globalCustomInstructions.loadFromFile"
					components={{
						span: (
							<span
								className="text-vscode-textLink-foreground cursor-pointer underline"
								onClick={() =>
									rootStore.settings.openFile("./.jabberwock/rules/rules.md", {
										create: true,
										content: "",
									})
								}
							/>
						),
						"0": (
							<VSCodeLink
								href={buildDocLink(
									"features/custom-instructions#setting-up-global-rules",
									"prompts_global_rules",
								)}
								style={{ display: "inline" }}
								aria-label="Learn about setting up global custom instructions"
							/>
						),
					}}
				/>
			</div>
		</div>
	)
}
