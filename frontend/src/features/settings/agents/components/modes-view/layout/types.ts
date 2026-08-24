import type { ModeConfig, GroupEntry, ToolGroup, PromptComponent, ModeSource } from "../types"

export type ModesViewLayoutProps = {
	t: (key: string, options?: Record<string, unknown>) => string
	visualMode: string
	displayModes: ModeConfig[]
	searchValue: string
	open: boolean
	isRenamingMode: boolean
	renameInputValue: string
	renameInputRef: React.RefObject<HTMLInputElement | null>
	searchInputRef: React.RefObject<HTMLInputElement | null>
	isExporting: boolean
	isImporting: boolean
	isCreateModeDialogOpen: boolean
	isDialogOpen: boolean
	showImportDialog: boolean
	showDeleteConfirm: boolean
	showConfigMenu: boolean
	isToolsEditMode: boolean
	isCustomMode: boolean | undefined
	currentModeName: string
	currentModeSlug: string
	currentMode: ModeConfig | undefined
	customModes: ModeConfig[] | undefined
	customModePrompts: Record<string, PromptComponent | undefined> | undefined
	customInstructions: string | undefined
	listApiConfigMeta: readonly { id: string; name: string }[] | undefined
	currentApiConfigName: string | undefined
	selectedPromptTitle: string
	selectedPromptContent: string
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
	importLevel: "global" | "project"
	modeToDelete: { slug: string; name: string; source?: string; rulesFolderPath?: string } | null
	onOpenChange: (open: boolean) => void
	onSearchChange: (value: string) => void
	onClearSearch: () => void
	onModeSelect: (mode: ModeConfig) => void
	onStartRename: () => void
	onSaveRename: () => void
	onCancelRename: () => void
	onRenameInputChange: (value: string) => void
	onCreateMode: () => void
	onDeleteMode: () => void
	onExport: () => void
	getCurrentMode: () => ModeConfig | undefined
	setShowConfigMenu: (v: boolean | ((prev: boolean) => boolean)) => void
	setShowImportDialog: (v: boolean) => void
	setIsCreateModeDialogOpen: (v: boolean) => void
	setIsDialogOpen: (v: boolean) => void
	setIsToolsEditMode: (v: boolean) => void
	setIsImporting: (v: boolean) => void
	setImportLevel: (v: "global" | "project") => void
	setShowDeleteConfirm: (v: boolean) => void
	setModeToDelete: (v: { slug: string; name: string } | null) => void
	handleRoleDefinitionChange: (v: string) => void
	handleDescriptionChange: (v: string) => void
	handleWhenToUseChange: (v: string) => void
	handleCustomInstructionsChange: (v: string) => void
	handleAgentReset: (
		slug: string,
		type: "roleDefinition" | "description" | "whenToUse" | "customInstructions",
	) => void
	handleGroupChangeForTool: (group: ToolGroup, checked: boolean) => void
	handleCreateMode: () => void
	handleNameChange: (name: string) => void
	handleNewModeGroupToggle: (group: ToolGroup, checked: boolean) => void
	getRoleDefinitionVal: (s: string) => string
	getDescriptionVal: (s: string) => string
	getWhenToUseVal: (s: string) => string
	getCustomInstructionsVal: (s: string) => string
	onSlugChange: (slug: string) => void
	onDescriptionChange: (value: string) => void
	onRoleDefinitionChange: (value: string) => void
	onWhenToUseChange: (value: string) => void
	onCustomInstructionsChange: (value: string) => void
	onSourceChange: (source: ModeSource) => void
}
