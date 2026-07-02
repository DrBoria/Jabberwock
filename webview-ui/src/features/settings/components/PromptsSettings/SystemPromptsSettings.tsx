import { useState } from "react"
import { VSCodeTextArea } from "@vscode/webview-ui-toolkit/react"

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

const SYSTEM_PROMPT_SECTIONS = [
	{ id: "markdownRules", label: "Markdown Rules" },
	{ id: "toolUse", label: "Tool Use" },
	{ id: "capabilities", label: "Capabilities" },
	{ id: "modes", label: "Modes" },
	{ id: "rules", label: "Rules" },
	{ id: "systemInfo", label: "System Info" },
	{ id: "objective", label: "Objective" },
]

export const SystemPromptsSettings = observer(() => {
	const { t } = useAppTranslation()
	const systemPromptTemplates = rootStore.extensionState.systemPromptTemplates
	const [activeSection, setActiveSection] = useState<string>("markdownRules")

	const handleUpdateTemplate = (value: string | undefined) => {
		const newTemplates = { ...systemPromptTemplates }
		if (!value) {
			delete newTemplates[activeSection]
		} else {
			newTemplates[activeSection] = value
		}

		rootStore.setSystemPromptTemplates(newTemplates)

		rootStore.settings.updateSystemPromptTemplate(activeSection, value ?? "")
	}

	const handleReset = () => {
		handleUpdateTemplate(undefined)
	}

	const currentValue = systemPromptTemplates?.[activeSection] || ""

	return (
		<div>
			<SectionHeader description="Customize the core sections of the system prompt. Note that replacing these sections overrides default Jabberwock behavior. Leave empty to use default.">
				System Prompt Templates
			</SectionHeader>

			<Section>
				<SearchableSetting settingId="system-prompt-templates-select" section="prompts" label="Select Section">
					<Select value={activeSection} onValueChange={(type) => setActiveSection(type)}>
						<SelectTrigger className="w-full" data-testid="system-prompt-section-select-trigger">
							<SelectValue placeholder={t("settings:common.select")} />
						</SelectTrigger>
						<SelectContent>
							{SYSTEM_PROMPT_SECTIONS.map((section) => (
								<SelectItem key={section.id} value={section.id}>
									{section.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</SearchableSetting>

				<div className="mt-4">
					<div className="flex justify-between items-center mb-1">
						<label className="block font-medium">Template</label>
						<StandardTooltip content="Reset to default">
							<Button variant="ghost" size="icon" onClick={handleReset}>
								<span className="codicon codicon-discard"></span>
							</Button>
						</StandardTooltip>
					</div>

					<VSCodeTextArea
						resize="vertical"
						value={currentValue}
						onInput={(e) => {
							const value = getEventValue(e) ?? ""
							handleUpdateTemplate(value)
						}}
						rows={15}
						className="w-full"
						placeholder={`Enter custom template for ${activeSection}...`}
					/>
				</div>
			</Section>
		</div>
	)
})
