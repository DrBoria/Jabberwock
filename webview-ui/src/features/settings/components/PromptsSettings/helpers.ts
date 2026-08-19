import { supportPrompt, SupportPromptType } from "@shared/support-prompt"

export const updateSupportPrompt = (
	type: SupportPromptType,
	value: string | undefined,
	customSupportPrompts: Record<string, string | undefined>,
	setCustomSupportPrompts: (prompts: Record<string, string | undefined>) => void,
) => {
	const finalValue = value ?? undefined
	const updatedPrompts = { ...customSupportPrompts }
	if (finalValue === undefined) delete updatedPrompts[type]
	else updatedPrompts[type] = finalValue
	setCustomSupportPrompts(updatedPrompts)
}

export const handleSupportReset = (
	type: SupportPromptType,
	customSupportPrompts: Record<string, string | undefined>,
	setCustomSupportPrompts: (prompts: Record<string, string | undefined>) => void,
) => {
	const updatedPrompts = { ...customSupportPrompts }
	delete updatedPrompts[type]
	setCustomSupportPrompts(updatedPrompts)
}

export const getSupportPromptValue = (
	type: SupportPromptType,
	customSupportPrompts: Record<string, string | undefined>,
): string => {
	const value = supportPrompt.get(customSupportPrompts, type)
	return value
}
