import { useCallback } from "react"
import type { ModeConfig, PromptComponent, ToolGroup } from "@jabberwock/types"

type Mode = string
import {
	findModeBySlug as findCustomModeBySlug,
	getRoleDefinition,
	getDescription,
	getWhenToUse,
	getCustomInstructions,
} from "@shared/modes"
import { rootStore } from "@src/features/store"

export interface UseModeFieldHandlersResult {
	handleRoleDefinitionChange: (value: string) => void
	handleDescriptionChange: (value: string) => void
	handleWhenToUseChange: (value: string) => void
	handleCustomInstructionsChange: (value: string) => void
	handleAgentReset: (
		modeSlug: string,
		type: "roleDefinition" | "description" | "whenToUse" | "customInstructions",
	) => void
	handleGroupChangeForTool: (group: ToolGroup, checked: boolean) => void
	getRoleDefinitionVal: (s: string) => string
	getDescriptionVal: (s: string) => string
	getWhenToUseVal: (s: string) => string
	getCustomInstructionsVal: (s: string) => string
}

export function useModeFieldHandlers(
	visualMode: string,
	customModes: ModeConfig[] | undefined,
	customModePrompts: Record<string, PromptComponent | undefined> | undefined,
	updateCustomMode: (slug: string, config: ModeConfig) => void,
	updateAgentPrompt: (modeSlug: Mode, promptData: PromptComponent) => void,
	findModeBySlug: (searchSlug: string, m: ModeConfig[] | undefined) => ModeConfig | undefined,
): UseModeFieldHandlersResult {
	const handleRoleDefinitionChange = useCallback(
		(value: string) => {
			const c = findModeBySlug(visualMode, customModes)
			if (c) {
				updateCustomMode(visualMode, { ...c, roleDefinition: value.trim() || "", source: c.source || "global" })
			} else {
				updateAgentPrompt(visualMode, { roleDefinition: value.trim() || undefined })
			}
		},
		[visualMode, customModes, findModeBySlug, updateCustomMode, updateAgentPrompt],
	)

	const handleDescriptionChange = useCallback(
		(value: string) => {
			const c = findModeBySlug(visualMode, customModes)
			if (c) {
				updateCustomMode(visualMode, {
					...c,
					description: value.trim() || undefined,
					source: c.source || "global",
				})
			} else {
				updateAgentPrompt(visualMode, { description: value.trim() || undefined })
			}
		},
		[visualMode, customModes, findModeBySlug, updateCustomMode, updateAgentPrompt],
	)

	const handleWhenToUseChange = useCallback(
		(value: string) => {
			const c = findModeBySlug(visualMode, customModes)
			if (c) {
				updateCustomMode(visualMode, {
					...c,
					whenToUse: value.trim() || undefined,
					source: c.source || "global",
				})
			} else {
				updateAgentPrompt(visualMode, { whenToUse: value.trim() || undefined })
			}
		},
		[visualMode, customModes, findModeBySlug, updateCustomMode, updateAgentPrompt],
	)

	const handleCustomInstructionsChange = useCallback(
		(value: string) => {
			const customMode = findModeBySlug(visualMode, customModes)
			if (customMode)
				updateCustomMode(visualMode, {
					...customMode,
					customInstructions: value ?? undefined,
					source: customMode.source || "global",
				})
			else {
				const existingPrompt = customModePrompts?.[visualMode] as PromptComponent
				updateAgentPrompt(visualMode, { ...existingPrompt, customInstructions: value.trim() || undefined })
			}
		},
		[visualMode, customModes, findModeBySlug, updateCustomMode, updateAgentPrompt, customModePrompts],
	)

	const handleGroupChangeForTool = useCallback(
		(group: ToolGroup, checked: boolean) => {
			const customMode = findModeBySlug(visualMode, customModes)
			if (!customMode) return
			const newGroups = checked
				? [...(customMode.groups || []), group]
				: (customMode.groups || []).filter((g) => (Array.isArray(g) ? g[0] : g) !== group)
			updateCustomMode(customMode.slug, {
				...customMode,
				groups: newGroups,
				source: customMode.source || "global",
			})
		},
		[visualMode, customModes, findModeBySlug, updateCustomMode],
	)

	const handleAgentReset = (
		modeSlug: string,
		type: "roleDefinition" | "description" | "whenToUse" | "customInstructions",
	) => {
		const updatedPrompt = { ...(customModePrompts?.[modeSlug] as PromptComponent) }
		delete updatedPrompt[type]
		rootStore.settings.updatePrompt(modeSlug, updatedPrompt)
	}

	const getRoleDefinitionVal = useCallback(
		(s: string) => findCustomModeBySlug(s, customModes)?.roleDefinition ?? getRoleDefinition(s),
		[customModes],
	)
	const getDescriptionVal = useCallback(
		(s: string) => findCustomModeBySlug(s, customModes)?.description ?? getDescription(s),
		[customModes],
	)
	const getWhenToUseVal = useCallback(
		(s: string) => findCustomModeBySlug(s, customModes)?.whenToUse ?? getWhenToUse(s),
		[customModes],
	)
	const getCustomInstructionsVal = useCallback((s: string) => getCustomInstructions(s, customModes), [customModes])

	return {
		handleRoleDefinitionChange,
		handleDescriptionChange,
		handleWhenToUseChange,
		handleCustomInstructionsChange,
		handleAgentReset,
		handleGroupChangeForTool,
		getRoleDefinitionVal,
		getDescriptionVal,
		getWhenToUseVal,
		getCustomInstructionsVal,
	}
}
