import React from "react"
import { CreateModeDialog } from "../create-mode/dialog"
import { SystemPromptPreviewDialog, ImportModeDialog } from "../dialogs"
import { DeleteModeDialog } from "@/features/settings/agents/components/DeleteModeDialog"
import { rootStore } from "@src/features/store"

interface ModesViewDialogsProps {
	isCreateModeDialogOpen: boolean
	setIsCreateModeDialogOpen: (v: boolean) => void
	isDialogOpen: boolean
	setIsDialogOpen: (v: boolean) => void
	showImportDialog: boolean
	setShowImportDialog: (v: boolean) => void
	showDeleteConfirm: boolean
	setShowDeleteConfirm: (v: boolean) => void
	setModeToDelete: (v: { slug: string; name: string } | null) => void
	isImporting: boolean
	setIsImporting: (v: boolean) => void
	importLevel: "global" | "project"
	setImportLevel: (v: "global" | "project") => void
	modeToDelete: { slug: string; name: string; source?: string; rulesFolderPath?: string } | null
	selectedPromptTitle: string
	selectedPromptContent: string
	currentModeName: string
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
	onNameChange: (name: string) => void
	onSlugChange: (slug: string) => void
	onDescriptionChange: (value: string) => void
	onRoleDefinitionChange: (value: string) => void
	onWhenToUseChange: (value: string) => void
	onCustomInstructionsChange: (value: string) => void
	onSourceChange: (source: ModeSource) => void
	onGroupToggle: (group: ToolGroup, checked: boolean) => void
	onCreate: () => void
	t: (key: string, options?: Record<string, unknown>) => string
}

import type { GroupEntry, ToolGroup, ModeSource } from "../types"

export function ModesViewDialogs({
	isCreateModeDialogOpen,
	setIsCreateModeDialogOpen,
	isDialogOpen,
	setIsDialogOpen,
	showImportDialog,
	setShowImportDialog,
	showDeleteConfirm,
	setShowDeleteConfirm,
	setModeToDelete,
	isImporting,
	setIsImporting,
	importLevel,
	setImportLevel,
	modeToDelete,
	selectedPromptTitle,
	selectedPromptContent,
	currentModeName,
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
	onNameChange,
	onSlugChange,
	onDescriptionChange,
	onRoleDefinitionChange,
	onWhenToUseChange,
	onCustomInstructionsChange,
	onSourceChange,
	onGroupToggle,
	onCreate,
	t,
}: ModesViewDialogsProps) {
	return (
		<>
			<CreateModeDialog
				open={isCreateModeDialogOpen}
				onClose={() => setIsCreateModeDialogOpen(false)}
				newModeName={newModeName}
				newModeSlug={newModeSlug}
				newModeDescription={newModeDescription}
				newModeRoleDefinition={newModeRoleDefinition}
				newModeWhenToUse={newModeWhenToUse}
				newModeCustomInstructions={newModeCustomInstructions}
				newModeGroups={newModeGroups}
				newModeSource={newModeSource}
				nameError={nameError}
				slugError={slugError}
				descriptionError={descriptionError}
				roleDefinitionError={roleDefinitionError}
				groupsError={groupsError}
				onNameChange={onNameChange}
				onSlugChange={onSlugChange}
				onDescriptionChange={onDescriptionChange}
				onRoleDefinitionChange={onRoleDefinitionChange}
				onWhenToUseChange={onWhenToUseChange}
				onCustomInstructionsChange={onCustomInstructionsChange}
				onSourceChange={onSourceChange}
				onGroupToggle={onGroupToggle}
				onCreate={onCreate}
			/>
			<SystemPromptPreviewDialog
				open={isDialogOpen}
				onClose={() => setIsDialogOpen(false)}
				title={selectedPromptTitle || t("prompts:systemPrompt.title", { modeName: currentModeName })}
				content={selectedPromptContent}
			/>
			<ImportModeDialog
				open={showImportDialog}
				importLevel={importLevel}
				isImporting={isImporting}
				onLevelChange={setImportLevel}
				onImport={() => {
					if (!isImporting) {
						setIsImporting(true)
						rootStore.settings.importMode(importLevel)
					}
				}}
				onClose={() => setShowImportDialog(false)}
			/>
			<DeleteModeDialog
				open={showDeleteConfirm}
				onOpenChange={setShowDeleteConfirm}
				modeToDelete={modeToDelete}
				onConfirm={() => {
					if (modeToDelete) {
						rootStore.settings.deleteCustomMode(modeToDelete.slug)
						setShowDeleteConfirm(false)
						setModeToDelete(null)
					}
				}}
			/>
		</>
	)
}
