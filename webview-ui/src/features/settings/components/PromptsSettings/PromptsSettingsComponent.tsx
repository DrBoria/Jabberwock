import { useState, useEffect } from "react"
import { VSCodeTextArea } from "@vscode/webview-ui-toolkit/react"
import { supportPrompt, SupportPromptType } from "@shared/support-prompt"
import { getEventValue } from "@src/utils/helpers/getEventValue"
import { rootStore } from "@src/features/store"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { observer } from "mobx-react-lite"
import { Button } from "@src/shared/ui/buttons/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@src/shared/ui/selects/select"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"
import { SectionHeader } from "../shared/SectionHeader"
import { Section } from "../shared/Section"
import { SearchableSetting } from "../shared/SearchableSetting"
import type { PromptsSettingsProps } from "./types"
import { updateSupportPrompt, handleSupportReset, getSupportPromptValue } from "./helpers"
import { EnhanceSection } from "./EnhanceSection"

const PromptsSettings = observer(
	({
		customSupportPrompts,
		setCustomSupportPrompts,
		includeTaskHistoryInEnhance: propsIncludeTaskHistoryInEnhance,
		setIncludeTaskHistoryInEnhance: propsSetIncludeTaskHistoryInEnhance,
	}: PromptsSettingsProps) => {
		const { t } = useAppTranslation()
		const listApiConfigMeta = rootStore.extensionState.listApiConfigMeta
		const enhancementApiConfigId = rootStore.extensionState.enhancementApiConfigId
		const setEnhancementApiConfigId = rootStore.setEnhancementApiConfigId
		const contextIncludeTaskHistoryInEnhance = rootStore.settings.includeTaskHistoryInEnhance
		const contextSetIncludeTaskHistoryInEnhance = rootStore.setIncludeTaskHistoryInEnhance
		const includeTaskHistoryInEnhance =
			propsIncludeTaskHistoryInEnhance ?? contextIncludeTaskHistoryInEnhance ?? true
		const setIncludeTaskHistoryInEnhance =
			propsSetIncludeTaskHistoryInEnhance ?? contextSetIncludeTaskHistoryInEnhance
		const [testPrompt, setTestPrompt] = useState("")
		const [isEnhancing, setIsEnhancing] = useState(false)
		const [activeSupportOption, setActiveSupportOption] = useState<SupportPromptType>("ENHANCE")

		useEffect(() => {
			const handler = (event: MessageEvent) => {
				const message = event.data
				if (message.type === "enhancedPrompt") {
					if (message.text) setTestPrompt(message.text)
					setIsEnhancing(false)
				}
			}
			window.addEventListener("message", handler)
			return () => window.removeEventListener("message", handler)
		}, [])

		const handleTestEnhancement = () => {
			if (!testPrompt.trim()) return
			setIsEnhancing(true)
			rootStore.chat.enhancePrompt(testPrompt)
		}

		return (
			<div>
				<SectionHeader description={t("settings:prompts.description")}>
					{t("settings:sections.prompts")}
				</SectionHeader>
				<Section>
					<SearchableSetting
						settingId="prompts-support-prompt-select"
						section="prompts"
						label={t("settings:sections.prompts")}>
						<Select
							value={activeSupportOption}
							onValueChange={(type) => setActiveSupportOption(type as SupportPromptType)}>
							<SelectTrigger className="w-full" data-testid="support-prompt-select-trigger">
								<SelectValue placeholder={t("settings:common.select")} />
							</SelectTrigger>
							<SelectContent>
								{Object.keys(supportPrompt.default)
									.filter((type) => type !== "CONDENSE")
									.map((type) => (
										<SelectItem key={type} value={type} data-testid={`${type}-option`}>
											{t(`prompts:supportPrompts.types.${type}.label`)}
										</SelectItem>
									))}
							</SelectContent>
						</Select>
						<div className="text-sm text-vscode-descriptionForeground mt-1">
							{t(`prompts:supportPrompts.types.${activeSupportOption}.description`)}
						</div>
					</SearchableSetting>
					<div key={activeSupportOption} className="mt-4">
						<div className="flex justify-between items-center mb-1">
							<label className="block font-medium">{t("prompts:supportPrompts.prompt")}</label>
							<StandardTooltip
								content={t("prompts:supportPrompts.resetPrompt", { promptType: activeSupportOption })}>
								<Button
									variant="ghost"
									size="icon"
									onClick={() =>
										handleSupportReset(
											activeSupportOption,
											customSupportPrompts,
											setCustomSupportPrompts,
										)
									}>
									<span className="codicon codicon-discard"></span>
								</Button>
							</StandardTooltip>
						</div>
						<VSCodeTextArea
							resize="vertical"
							value={getSupportPromptValue(activeSupportOption, customSupportPrompts)}
							onInput={(e) => {
								const value = getEventValue(e) ?? ""
								updateSupportPrompt(
									activeSupportOption,
									value,
									customSupportPrompts,
									setCustomSupportPrompts,
								)
							}}
							rows={6}
							className="w-full"
						/>
						{activeSupportOption === "ENHANCE" && (
							<EnhanceSection
								enhancementApiConfigId={enhancementApiConfigId ?? ""}
								setEnhancementApiConfigId={setEnhancementApiConfigId}
								listApiConfigMeta={listApiConfigMeta}
								includeTaskHistoryInEnhance={includeTaskHistoryInEnhance}
								setIncludeTaskHistoryInEnhance={setIncludeTaskHistoryInEnhance}
								testPrompt={testPrompt}
								setTestPrompt={setTestPrompt}
								isEnhancing={isEnhancing}
								handleTestEnhancement={handleTestEnhancement}
							/>
						)}
					</div>
				</Section>
			</div>
		)
	},
)

export default PromptsSettings
