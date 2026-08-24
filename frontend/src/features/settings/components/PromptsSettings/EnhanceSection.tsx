import { VSCodeCheckbox, VSCodeTextArea } from "@vscode/webview-ui-toolkit/react"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "@src/shared/ui/buttons/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@src/shared/ui/selects/select"
import { rootStore } from "@src/features/store"

interface EnhanceSectionProps {
	enhancementApiConfigId: string
	setEnhancementApiConfigId: (id: string) => void
	listApiConfigMeta: { id: string; name: string }[] | undefined
	includeTaskHistoryInEnhance: boolean
	setIncludeTaskHistoryInEnhance: (value: boolean) => void
	testPrompt: string
	setTestPrompt: (value: string) => void
	isEnhancing: boolean
	handleTestEnhancement: () => void
}

export const EnhanceSection = ({
	enhancementApiConfigId,
	setEnhancementApiConfigId,
	listApiConfigMeta,
	includeTaskHistoryInEnhance,
	setIncludeTaskHistoryInEnhance,
	testPrompt,
	setTestPrompt,
	isEnhancing,
	handleTestEnhancement,
}: EnhanceSectionProps) => {
	const { t } = useAppTranslation()

	return (
		<div className="mt-4 flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background">
			<div>
				<label className="block font-medium mb-1">{t("prompts:supportPrompts.enhance.apiConfiguration")}</label>
				<Select
					value={enhancementApiConfigId || "-"}
					onValueChange={(value) => {
						const newConfigId = value === "-" ? "" : value
						setEnhancementApiConfigId(newConfigId)
						rootStore.settings.setEnhancementApiConfigId(value)
					}}>
					<SelectTrigger data-testid="api-config-select" className="w-full">
						<SelectValue placeholder={t("prompts:supportPrompts.enhance.useCurrentConfig")} />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="-">{t("prompts:supportPrompts.enhance.useCurrentConfig")}</SelectItem>
						{(listApiConfigMeta || []).map((config) => (
							<SelectItem key={config.id} value={config.id} data-testid={`${config.id}-option`}>
								{config.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<div className="text-sm text-vscode-descriptionForeground mt-1">
					{t("prompts:supportPrompts.enhance.apiConfigDescription")}
				</div>
			</div>
			<div>
				<VSCodeCheckbox
					checked={includeTaskHistoryInEnhance}
					onChange={(e: Event | React.FormEvent<HTMLElement>) => {
						const target = ("target" in e ? e.target : null) as HTMLInputElement | null
						if (!target) return
						setIncludeTaskHistoryInEnhance(target.checked)
						rootStore.settings.updateSettings({
							includeTaskHistoryInEnhance: target.checked,
						})
					}}>
					<span className="font-medium">{t("prompts:supportPrompts.enhance.includeTaskHistory")}</span>
				</VSCodeCheckbox>
				<div className="text-vscode-descriptionForeground text-sm mt-1 mb-3">
					{t("prompts:supportPrompts.enhance.includeTaskHistoryDescription")}
				</div>
			</div>
			<div>
				<label className="block font-medium mb-1">{t("prompts:supportPrompts.enhance.testEnhancement")}</label>
				<VSCodeTextArea
					resize="vertical"
					value={testPrompt}
					onChange={(e) => setTestPrompt((e.target as HTMLTextAreaElement).value)}
					placeholder={t("prompts:supportPrompts.enhance.testPromptPlaceholder")}
					rows={3}
					className="w-full"
					data-testid="test-prompt-textarea"
				/>
				<div className="mt-2 flex justify-start items-center gap-2">
					<Button variant="primary" onClick={handleTestEnhancement} disabled={isEnhancing}>
						{t("prompts:supportPrompts.enhance.previewButton")}
					</Button>
				</div>
			</div>
		</div>
	)
}
