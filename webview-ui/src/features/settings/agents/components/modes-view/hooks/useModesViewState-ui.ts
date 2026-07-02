import { useState, useEffect, useCallback, useRef } from "react"
import { useEscapeKey } from "@src/hooks/escape-key/useEscapeKey"
import { createMessageHandler } from "../handlers"
import type { MessageHandlerRefs } from "../types"

type ModeToDeleteValue = {
	slug: string
	name: string
	source?: string
	rulesFolderPath?: string
} | null

export interface UseModesViewStateUiResult {
	isDialogOpen: boolean
	selectedPromptContent: string
	selectedPromptTitle: string
	showConfigMenu: boolean
	isExporting: boolean
	isImporting: boolean
	showImportDialog: boolean
	importLevel: "global" | "project"
	hasRulesToExport: Record<string, boolean>
	showDeleteConfirm: boolean
	modeToDelete: ModeToDeleteValue
	open: boolean
	searchValue: string
	searchInputRef: React.RefObject<HTMLInputElement | null>
	setShowConfigMenu: (v: boolean | ((prev: boolean) => boolean)) => void
	setShowImportDialog: (v: boolean) => void
	setIsDialogOpen: (v: boolean) => void
	setIsExporting: (v: boolean) => void
	setIsImporting: (v: boolean) => void
	setImportLevel: (v: "global" | "project") => void
	setShowDeleteConfirm: (v: boolean) => void
	setModeToDelete: (v: ModeToDeleteValue | ((prev: ModeToDeleteValue) => ModeToDeleteValue)) => void
	onOpenChange: (open: boolean) => void
	onSearchChange: (value: string) => void
	onClearSearch: () => void
}

export function useModesViewStateUi(
	refs: MessageHandlerRefs,
	setVisualMode: (v: string) => void,
	checkRulesDirectory: (slug: string) => void,
	switchMode: (slug: string) => void,
): UseModesViewStateUiResult {
	const [isDialogOpen, setIsDialogOpen] = useState(false)
	const [selectedPromptContent, setSelectedPromptContent] = useState("")
	const [selectedPromptTitle, setSelectedPromptTitle] = useState("")
	const [showConfigMenu, setShowConfigMenu] = useState(false)
	const [isExporting, setIsExporting] = useState(false)
	const [isImporting, setIsImporting] = useState(false)
	const [showImportDialog, setShowImportDialog] = useState(false)
	const [importLevel, setImportLevel] = useState<"global" | "project">("project")
	const [hasRulesToExport, setHasRulesToExport] = useState<Record<string, boolean>>({})
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
	const [modeToDelete, setModeToDelete] = useState<{
		slug: string
		name: string
		source?: string
		rulesFolderPath?: string
	} | null>(null)
	const [open, setOpen] = useState(false)
	const [searchValue, setSearchValue] = useState("")
	const searchInputRef = useRef<HTMLInputElement>(null)

	const onOpenChange = useCallback((o: boolean) => {
		setOpen(o)
		if (!o) setTimeout(() => setSearchValue(""), 100)
	}, [])

	useEscapeKey(open, () => setOpen(false))

	const onClearSearch = useCallback(() => {
		setSearchValue("")
		searchInputRef.current?.focus()
	}, [])

	useEffect(() => {
		if (showImportDialog) setImportLevel("project")
	}, [showImportDialog])

	useEffect(() => {
		const handleClickOutside = () => {
			if (showConfigMenu) setShowConfigMenu(false)
		}
		document.addEventListener("click", handleClickOutside)
		return () => document.removeEventListener("click", handleClickOutside)
	}, [showConfigMenu])

	useEffect(() => {
		const handler = createMessageHandler(refs, {
			setSelectedPromptContent,
			setSelectedPromptTitle,
			setIsDialogOpen,
			setIsExporting,
			setIsImporting,
			setShowImportDialog,
			setVisualMode,
			setHasRulesToExport,
			setModeToDelete,
			setShowDeleteConfirm,
		})
		window.addEventListener("message", handler)
		return () => window.removeEventListener("message", handler)
	}, [refs, checkRulesDirectory, switchMode, setVisualMode])

	return {
		isDialogOpen,
		selectedPromptContent,
		selectedPromptTitle,
		showConfigMenu,
		isExporting,
		isImporting,
		showImportDialog,
		importLevel,
		hasRulesToExport,
		showDeleteConfirm,
		modeToDelete,
		open,
		searchValue,
		searchInputRef,
		setShowConfigMenu,
		setShowImportDialog,
		setIsDialogOpen,
		setIsExporting,
		setIsImporting,
		setImportLevel,
		setShowDeleteConfirm,
		setModeToDelete,
		onOpenChange,
		onSearchChange: setSearchValue,
		onClearSearch,
	}
}
