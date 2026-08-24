import type { ModeConfig, GroupEntry, PromptComponent } from "./types"
import { findModeBySlug as findCustomModeBySlug } from "@shared/modes"

export function getGroupName(group: GroupEntry): string {
	return Array.isArray(group) ? group[0] : group
}

export function getPromptFieldValue<K extends keyof PromptComponent>(
	slug: string,
	field: K,
	customModes: ModeConfig[] | undefined,
	customModePrompts: Record<string, PromptComponent | undefined> | undefined,
	getDefault: (s: string) => string,
): string {
	const customMode = findCustomModeBySlug(slug, customModes)
	const prompt = customModePrompts?.[slug] as PromptComponent | undefined
	const customVal = customMode?.[field as keyof ModeConfig]
	if (customVal != null && customVal !== "") return String(customVal)
	const promptVal = prompt?.[field]
	if (promptVal != null && promptVal !== "") return String(promptVal)
	return getDefault(slug)
}

export function getEditGroupDescription(currentMode: ModeConfig | undefined): string {
	const editGroup = currentMode?.groups?.find((g) => Array.isArray(g) && g[0] === "edit" && g[1]?.fileRegex)
	if (!Array.isArray(editGroup)) return ""
	return editGroup[1].description || `/${editGroup[1].fileRegex}/`
}
