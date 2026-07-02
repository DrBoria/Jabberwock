import { useState, useEffect, useCallback, useRef } from "react"
import type { ModeConfig, PromptComponent } from "@jabberwock/types"
import {
	getAllModes,
	getRoleDefinition,
	getDescription,
	getWhenToUse,
	findModeBySlug as findCustomModeBySlug,
} from "@shared/modes"
import type { Mode } from "@shared/modes"
import { rootStore } from "@src/features/store"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import type { ModesViewLayoutProps } from "../layout/types"
import type { MessageHandlerRefs } from "../types"
import { useCreateModeState } from "../create-mode/useCreateModeState"
import { useModeFieldHandlers } from "./useModeFieldHandlers"
import { useRenameMode } from "./useModesViewState-rename"
import { useModesViewStateUi } from "./useModesViewState-ui"
import { useModesViewStateCurrentMode } from "./useModesViewState-currentMode"

export interface UseModesViewStateResult extends ModesViewLayoutProps {
	t: (key: string, options?: Record<string, unknown>) => string
}

export function useModesViewState(): UseModesViewStateResult {
	const { t } = useAppTranslation()
	const { customModePrompts, listApiConfigMeta, currentApiConfigName, mode, customInstructions, customModes } =
		rootStore.extensionState
	const [visualMode, setVisualMode] = useState(mode)
	const [isToolsEditMode, setIsToolsEditMode] = useState(false)
	const modes = getAllModes(customModes)

	const updateAgentPrompt = useCallback(
		(modeSlug: Mode, promptData: PromptComponent) => {
			const updatedPrompt = { ...(customModePrompts?.[modeSlug] as PromptComponent), ...promptData }
			if (updatedPrompt.roleDefinition === getRoleDefinition(modeSlug)) delete updatedPrompt.roleDefinition
			if (updatedPrompt.description === getDescription(modeSlug)) delete updatedPrompt.description
			if (updatedPrompt.whenToUse === getWhenToUse(modeSlug)) delete updatedPrompt.whenToUse
			rootStore.settings.updatePrompt(modeSlug, updatedPrompt)
		},
		[customModePrompts],
	)

	const updateCustomMode = useCallback(
		(slug: string, config: ModeConfig) =>
			rootStore.settings.updateCustomMode(slug, { ...config, source: config.source || "global" }),
		[],
	)

	const findModeBySlug = useCallback(
		(searchSlug: string, m: ModeConfig[] | undefined): ModeConfig | undefined =>
			findCustomModeBySlug(searchSlug, m),
		[],
	)

	const switchMode = useCallback((slug: string) => rootStore.chat.switchMode(slug), [])
	const checkRulesDirectory = useCallback((slug: string) => rootStore.settings.checkRulesDirectory(slug), [])

	const handleModeSwitch = useCallback(
		(modeConfig: ModeConfig) => {
			if (modeConfig.slug === visualMode) return
			setVisualMode(modeConfig.slug)
			switchMode(modeConfig.slug)
			setIsToolsEditMode(false)
		},
		[visualMode, switchMode],
	)

	const handleModeSwitchRef = useRef(handleModeSwitch)
	const customModesRef = useRef(customModes)
	const switchModeRef = useRef(switchMode)
	const modeToDeleteRef = useRef<{ slug: string; name: string; source?: string; rulesFolderPath?: string } | null>(
		null,
	)
	useEffect(() => {
		handleModeSwitchRef.current = handleModeSwitch
	}, [handleModeSwitch])
	useEffect(() => {
		customModesRef.current = customModes
	}, [customModes])
	useEffect(() => {
		switchModeRef.current = switchMode
	}, [switchMode])
	useEffect(() => {
		setVisualMode(mode)
	}, [mode])

	const refs: MessageHandlerRefs = { customModesRef, handleModeSwitchRef, switchModeRef, modeToDeleteRef }
	const ui = useModesViewStateUi(refs, setVisualMode, checkRulesDirectory, switchMode)
	const rename = useRenameMode(visualMode, customModes, modes, updateCustomMode, findModeBySlug)
	const createMode = useCreateModeState(modes, updateCustomMode, switchMode)
	const fieldHandlers = useModeFieldHandlers(
		visualMode,
		customModes,
		customModePrompts,
		updateCustomMode,
		updateAgentPrompt,
		findModeBySlug,
	)

	const { getCurrentMode, currentMode } = useModesViewStateCurrentMode(
		visualMode,
		customModes,
		modes,
		rename,
		ui,
		checkRulesDirectory,
	)

	return {
		t,
		visualMode,
		displayModes: rename.displayModes,
		searchValue: ui.searchValue,
		open: ui.open,
		isRenamingMode: rename.isRenamingMode,
		renameInputValue: rename.renameInputValue,
		renameInputRef: rename.renameInputRef,
		searchInputRef: ui.searchInputRef,
		isExporting: ui.isExporting,
		isImporting: ui.isImporting,
		isCreateModeDialogOpen: createMode.isCreateModeDialogOpen,
		isDialogOpen: ui.isDialogOpen,
		showImportDialog: ui.showImportDialog,
		showDeleteConfirm: ui.showDeleteConfirm,
		showConfigMenu: ui.showConfigMenu,
		isToolsEditMode,
		isCustomMode: !!findModeBySlug(visualMode, customModes),
		currentModeName: currentMode?.name || "Code",
		currentModeSlug: currentMode?.slug || "code",
		currentMode,
		customModes,
		customModePrompts,
		customInstructions,
		listApiConfigMeta,
		currentApiConfigName,
		selectedPromptTitle: ui.selectedPromptTitle,
		selectedPromptContent: ui.selectedPromptContent,
		newModeName: createMode.newModeName,
		newModeSlug: createMode.newModeSlug,
		newModeDescription: createMode.newModeDescription,
		newModeRoleDefinition: createMode.newModeRoleDefinition,
		newModeWhenToUse: createMode.newModeWhenToUse,
		newModeCustomInstructions: createMode.newModeCustomInstructions,
		newModeGroups: createMode.newModeGroups,
		newModeSource: createMode.newModeSource,
		nameError: createMode.nameError,
		slugError: createMode.slugError,
		descriptionError: createMode.descriptionError,
		roleDefinitionError: createMode.roleDefinitionError,
		groupsError: createMode.groupsError,
		importLevel: ui.importLevel,
		modeToDelete: ui.modeToDelete,
		onOpenChange: ui.onOpenChange,
		onSearchChange: ui.onSearchChange,
		onClearSearch: ui.onClearSearch,
		onModeSelect: (mc: ModeConfig) => {
			handleModeSwitch(mc)
			ui.onOpenChange(false)
		},
		onStartRename: rename.handleStartRenameMode,
		onSaveRename: rename.handleSaveRenameMode,
		onCancelRename: rename.handleCancelRenameMode,
		onRenameInputChange: rename.setRenameInputValue,
		onCreateMode: createMode.openCreateModeDialog,
		onDeleteMode: () => {
			const c = findModeBySlug(visualMode, customModes)
			if (c) {
				ui.setModeToDelete({ slug: c.slug, name: c.name, source: c.source || "global" })
				rootStore.settings.deleteCustomMode(c.slug, true)
			}
		},
		onExport: () => {
			const cm = getCurrentMode()
			if (cm?.slug && !ui.isExporting) {
				ui.setIsExporting(true)
				rootStore.settings.exportMode(cm.slug)
			}
		},
		getCurrentMode,
		setShowConfigMenu: ui.setShowConfigMenu,
		setShowImportDialog: ui.setShowImportDialog,
		setIsCreateModeDialogOpen: createMode.setIsCreateModeDialogOpen,
		setIsDialogOpen: ui.setIsDialogOpen,
		setIsToolsEditMode,
		setIsImporting: ui.setIsImporting,
		setImportLevel: ui.setImportLevel,
		setShowDeleteConfirm: ui.setShowDeleteConfirm,
		setModeToDelete: ui.setModeToDelete,
		handleRoleDefinitionChange: fieldHandlers.handleRoleDefinitionChange,
		handleDescriptionChange: fieldHandlers.handleDescriptionChange,
		handleWhenToUseChange: fieldHandlers.handleWhenToUseChange,
		handleCustomInstructionsChange: fieldHandlers.handleCustomInstructionsChange,
		handleAgentReset: fieldHandlers.handleAgentReset,
		handleGroupChangeForTool: fieldHandlers.handleGroupChangeForTool,
		handleCreateMode: createMode.handleCreateMode,
		handleNameChange: createMode.handleNameChange,
		handleNewModeGroupToggle: createMode.handleNewModeGroupToggle,
		onSlugChange: createMode.onSlugChange,
		onDescriptionChange: createMode.onDescriptionChange,
		onRoleDefinitionChange: createMode.onRoleDefinitionChange,
		onWhenToUseChange: createMode.onWhenToUseChange,
		onCustomInstructionsChange: createMode.onCustomInstructionsChange,
		onSourceChange: createMode.onSourceChange,
		getRoleDefinitionVal: fieldHandlers.getRoleDefinitionVal,
		getDescriptionVal: fieldHandlers.getDescriptionVal,
		getWhenToUseVal: fieldHandlers.getWhenToUseVal,
		getCustomInstructionsVal: fieldHandlers.getCustomInstructionsVal,
	}
}
