export interface PromptsSettingsProps {
	customSupportPrompts: Record<string, string | undefined>
	setCustomSupportPrompts: (prompts: Record<string, string | undefined>) => void
	includeTaskHistoryInEnhance?: boolean
	setIncludeTaskHistoryInEnhance?: (value: boolean) => void
}
