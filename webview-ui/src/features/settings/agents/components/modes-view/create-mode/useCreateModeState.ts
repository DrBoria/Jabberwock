import { useState, useEffect, useCallback } from "react"
import { modeConfigSchema } from "@jabberwock/types"
import type { ModeConfig, GroupEntry, ToolGroup } from "@jabberwock/types"
import { availableGroups, type ModeSource } from "../types"
import { generateSlug, isNameOrSlugTaken, validateModeErrors } from "./utils"

export interface UseCreateModeStateResult {
	isCreateModeDialogOpen: boolean
	newModeName: string
	newModeSlug: string
	newModeDescription: string
	newModeRoleDefinition: string
	newModeWhenToUse: string
	newModeCustomInstructions: string
	newModeGroups: GroupEntry[]
	newModeSource: ModeSource
	nameError: string
	slugError: string
	descriptionError: string
	roleDefinitionError: string
	groupsError: string
	handleCreateMode: () => void
	handleNameChange: (name: string) => void
	handleNewModeGroupToggle: (group: ToolGroup, checked: boolean) => void
	openCreateModeDialog: () => void
	resetFormState: () => void
	setIsCreateModeDialogOpen: (v: boolean) => void
	onSlugChange: (slug: string) => void
	onDescriptionChange: (value: string) => void
	onRoleDefinitionChange: (value: string) => void
	onWhenToUseChange: (value: string) => void
	onCustomInstructionsChange: (value: string) => void
	onSourceChange: (source: ModeSource) => void
	validateModeErrors: (
		result: { success: boolean; error?: { errors: Array<{ path: (string | number)[]; message: string }> } },
		setters: {
			setNameError: (v: string) => void
			setSlugError: (v: string) => void
			setDescriptionError: (v: string) => void
			setRoleDefinitionError: (v: string) => void
			setGroupsError: (v: string) => void
		},
	) => boolean
}

export function useCreateModeState(
	modes: ModeConfig[],
	updateCustomMode: (slug: string, config: ModeConfig) => void,
	switchMode: (slug: string) => void,
): UseCreateModeStateResult {
	const [newModeName, setNewModeName] = useState("")
	const [newModeSlug, setNewModeSlug] = useState("")
	const [newModeDescription, setNewModeDescription] = useState("")
	const [newModeRoleDefinition, setNewModeRoleDefinition] = useState("")
	const [newModeWhenToUse, setNewModeWhenToUse] = useState("")
	const [newModeCustomInstructions, setNewModeCustomInstructions] = useState("")
	const [newModeGroups, setNewModeGroups] = useState<GroupEntry[]>(availableGroups)
	const [newModeSource, setNewModeSource] = useState<ModeSource>("global")
	const [nameError, setNameError] = useState("")
	const [slugError, setSlugError] = useState("")
	const [descriptionError, setDescriptionError] = useState("")
	const [roleDefinitionError, setRoleDefinitionError] = useState("")
	const [groupsError, setGroupsError] = useState("")
	const [isCreateModeDialogOpen, setIsCreateModeDialogOpen] = useState(false)

	const resetFormState = useCallback(() => {
		setNewModeName("")
		setNewModeSlug("")
		setNewModeDescription("")
		setNewModeGroups(availableGroups)
		setNewModeRoleDefinition("")
		setNewModeWhenToUse("")
		setNewModeCustomInstructions("")
		setNewModeSource("global")
		setNameError("")
		setSlugError("")
		setDescriptionError("")
		setRoleDefinitionError("")
		setGroupsError("")
	}, [])

	const handleNameChange = useCallback((name: string) => {
		setNewModeName(name)
		setNewModeSlug(generateSlug(name))
	}, [])

	const openCreateModeDialog = useCallback(() => {
		const baseNamePrefix = "New Custom Mode"
		let attempt = 0
		let name = baseNamePrefix
		let slug = generateSlug(name)
		while (isNameOrSlugTaken(name, slug, modes)) {
			attempt++
			name = `${baseNamePrefix} ${attempt + 1}`
			slug = generateSlug(name)
		}
		setNewModeName(name)
		setNewModeSlug(slug)
		setIsCreateModeDialogOpen(true)
	}, [modes])

	const handleCreateMode = useCallback(() => {
		setNameError("")
		setSlugError("")
		setDescriptionError("")
		setRoleDefinitionError("")
		setGroupsError("")
		const newMode: ModeConfig = {
			slug: newModeSlug,
			name: newModeName,
			description: newModeDescription.trim() || undefined,
			roleDefinition: newModeRoleDefinition.trim(),
			whenToUse: newModeWhenToUse.trim() || undefined,
			customInstructions: newModeCustomInstructions.trim() || undefined,
			groups: newModeGroups,
			source: newModeSource,
		}
		const result = (
			modeConfigSchema as {
				safeParse(data: unknown): {
					success: boolean
					error?: { errors: Array<{ path: (string | number)[]; message: string }> }
				}
			}
		).safeParse(newMode)
		const hasErrors = validateModeErrors(result, {
			setNameError,
			setSlugError,
			setDescriptionError,
			setRoleDefinitionError,
			setGroupsError,
		})
		if (hasErrors) return
		updateCustomMode(newModeSlug, newMode)
		switchMode(newModeSlug)
		setIsCreateModeDialogOpen(false)
		resetFormState()
	}, [
		newModeName,
		newModeSlug,
		newModeDescription,
		newModeRoleDefinition,
		newModeWhenToUse,
		newModeCustomInstructions,
		newModeGroups,
		newModeSource,
		updateCustomMode,
		switchMode,
		resetFormState,
	])

	useEffect(() => {
		if (isCreateModeDialogOpen) resetFormState()
	}, [isCreateModeDialogOpen, resetFormState])

	const handleNewModeGroupToggle = useCallback(
		(group: ToolGroup, checked: boolean) => {
			setNewModeGroups(
				checked
					? [...newModeGroups, group]
					: newModeGroups.filter((g) => (Array.isArray(g) ? g[0] : g) !== group),
			)
		},
		[newModeGroups],
	)

	return {
		isCreateModeDialogOpen,
		setIsCreateModeDialogOpen,
		newModeName,
		newModeSlug,
		newModeDescription,
		newModeRoleDefinition,
		newModeWhenToUse,
		newModeCustomInstructions,
		newModeGroups,
		newModeSource,
		nameError,
		slugError,
		descriptionError,
		roleDefinitionError,
		groupsError,
		handleCreateMode,
		handleNameChange,
		handleNewModeGroupToggle,
		openCreateModeDialog,
		resetFormState,
		validateModeErrors,
		onSlugChange: setNewModeSlug,
		onDescriptionChange: setNewModeDescription,
		onRoleDefinitionChange: setNewModeRoleDefinition,
		onWhenToUseChange: setNewModeWhenToUse,
		onCustomInstructionsChange: setNewModeCustomInstructions,
		onSourceChange: setNewModeSource,
	}
}
