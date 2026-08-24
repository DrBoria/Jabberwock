import { useState, useEffect, useMemo, useCallback } from "react"
import type { SkillMetadata } from "@jabberwock/types"
import { getAllModes } from "@shared/modes"
import { rootStore } from "@src/features/store"

export const useSkillsSettings = () => {
	const cwd = rootStore.extensionState.cwd
	const rawSkills = rootStore.marketplace.skills
	const customModes = rootStore.extensionState.customModes
	const skills = useMemo(() => rawSkills ?? [], [rawSkills])
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
	const [skillToDelete, setSkillToDelete] = useState<SkillMetadata | null>(null)
	const [createDialogOpen, setCreateDialogOpen] = useState(false)
	const [modeDialogOpen, setModeDialogOpen] = useState(false)
	const [skillToEditModes, setSkillToEditModes] = useState<SkillMetadata | null>(null)
	const [selectedModes, setSelectedModes] = useState<string[]>([])
	const [isAnyMode, setIsAnyMode] = useState(true)
	const hasWorkspace = Boolean(cwd)
	const availableModes = useMemo(
		() => getAllModes(customModes).map((m) => ({ slug: m.slug, name: m.name })),
		[customModes],
	)
	const handleRefresh = useCallback(() => rootStore.marketplace.requestSkills(), [])
	useEffect(() => {
		handleRefresh()
	}, [handleRefresh])
	const handleDeleteClick = useCallback((skill: SkillMetadata) => {
		setSkillToDelete(skill)
		setDeleteDialogOpen(true)
	}, [])
	const handleDeleteConfirm = useCallback(() => {
		if (skillToDelete) {
			rootStore.marketplace.deleteSkill(skillToDelete.name)
			setDeleteDialogOpen(false)
			setSkillToDelete(null)
		}
	}, [skillToDelete])
	const handleDeleteCancel = useCallback(() => {
		setDeleteDialogOpen(false)
		setSkillToDelete(null)
	}, [])
	const handleEditClick = useCallback((skill: SkillMetadata) => rootStore.marketplace.openSkillFile(skill.name), [])
	const handleOpenModeDialog = useCallback((skill: SkillMetadata) => {
		setSkillToEditModes(skill)
		const hasModeSlugs = skill.modeSlugs && skill.modeSlugs.length > 0
		setIsAnyMode(!hasModeSlugs)
		setSelectedModes(hasModeSlugs ? [...skill.modeSlugs!] : [])
		setModeDialogOpen(true)
	}, [])
	const handleAnyModeToggle = useCallback((checked: boolean) => {
		if (checked) {
			setIsAnyMode(true)
			setSelectedModes([])
		} else setIsAnyMode(false)
	}, [])
	const handleModeToggle = useCallback((modeSlug: string, checked: boolean) => {
		if (checked) {
			setIsAnyMode(false)
			setSelectedModes((prev) => [...prev, modeSlug])
		} else
			setSelectedModes((prev) => {
				const newModes = prev.filter((m) => m !== modeSlug)
				if (newModes.length === 0) setIsAnyMode(true)
				return newModes
			})
	}, [])
	const handleSaveModes = useCallback(() => {
		if (skillToEditModes) {
			const newModeSlugs = isAnyMode ? undefined : selectedModes.length > 0 ? selectedModes : undefined
			rootStore.marketplace.updateSkillModes(skillToEditModes.name, newModeSlugs)
			setModeDialogOpen(false)
			setSkillToEditModes(null)
		}
	}, [skillToEditModes, isAnyMode, selectedModes])
	const handleCloseModeDialog = useCallback(() => {
		setModeDialogOpen(false)
		setSkillToEditModes(null)
	}, [])
	const projectSkills = useMemo(() => skills.filter((skill) => skill.source === "project"), [skills])
	const globalSkills = useMemo(() => skills.filter((skill) => skill.source === "global"), [skills])

	return {
		t: undefined as never,
		cwd,
		skills,
		deleteDialogOpen,
		setDeleteDialogOpen,
		skillToDelete,
		createDialogOpen,
		setCreateDialogOpen,
		modeDialogOpen,
		setModeDialogOpen,
		skillToEditModes,
		selectedModes,
		isAnyMode,
		hasWorkspace,
		availableModes,
		handleRefresh,
		handleDeleteClick,
		handleDeleteConfirm,
		handleDeleteCancel,
		handleEditClick,
		handleOpenModeDialog,
		handleAnyModeToggle,
		handleModeToggle,
		handleSaveModes,
		handleCloseModeDialog,
		projectSkills,
		globalSkills,
	}
}
