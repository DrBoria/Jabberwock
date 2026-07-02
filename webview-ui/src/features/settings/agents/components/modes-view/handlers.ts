import type { MessageHandlerRefs, ImportModeResult } from "./types"
import { getAllModes, defaultModeSlug } from "@shared/modes"

type SystemPromptSetters = {
	setSelectedPromptContent: (v: string) => void
	setSelectedPromptTitle: (v: string) => void
	setIsDialogOpen: (v: boolean) => void
}

type ExportSetters = {
	setIsExporting: (v: boolean) => void
}

type ImportSetters = {
	setIsImporting: (v: boolean) => void
	setShowImportDialog: (v: boolean) => void
	setVisualMode: (v: string) => void
}

type CheckRulesSetters = {
	setHasRulesToExport: (fn: (prev: Record<string, boolean>) => Record<string, boolean>) => void
}

type DeleteModeCheckSetters = {
	setModeToDelete: (v: { slug: string; name: string; rulesFolderPath?: string } | null) => void
	setShowDeleteConfirm: (v: boolean) => void
}

export function handleSystemPrompt(message: { text?: string; mode?: string }, setters: SystemPromptSetters) {
	if (message?.text) {
		setters.setSelectedPromptContent(message.text)
		setters.setSelectedPromptTitle(`System Prompt (${message.mode} mode)`)
		setters.setIsDialogOpen(true)
	}
}

export function handleExportModeResult(message: { success?: boolean; error?: string }, setters: ExportSetters) {
	setters.setIsExporting(false)
	if (!message.success) {
		console.error("[jabberwock] Failed to export mode:", message.error)
	}
}

export function handleImportModeResult(
	message: ImportModeResult,
	refs: Pick<MessageHandlerRefs, "customModesRef" | "handleModeSwitchRef" | "switchModeRef">,
	setters: ImportSetters,
) {
	setters.setIsImporting(false)
	setters.setShowImportDialog(false)
	if (message.success) {
		const { slug } = message
		if (slug) {
			const all = getAllModes(refs.customModesRef.current)
			const importedMode = all.find((m) => m.slug === slug)
			if (importedMode) {
				refs.handleModeSwitchRef.current(importedMode)
			} else {
				setters.setVisualMode(defaultModeSlug)
				refs.switchModeRef.current?.(defaultModeSlug)
			}
		}
	} else {
		if (message.error !== "cancelled") {
			console.error("[jabberwock] Failed to import mode:", message.error)
		}
	}
}

export function handleCheckRulesDirectoryResult(
	message: { slug: string; hasContent: boolean },
	setters: CheckRulesSetters,
) {
	setters.setHasRulesToExport((prev) => ({
		...prev,
		[message.slug]: message.hasContent,
	}))
}

export function handleDeleteCustomModeCheck(
	message: { slug?: string; rulesFolderPath?: string },
	refs: Pick<MessageHandlerRefs, "modeToDeleteRef">,
	setters: DeleteModeCheckSetters,
) {
	const currentModeToDelete = refs.modeToDeleteRef.current
	if (message.slug && currentModeToDelete && currentModeToDelete.slug === message.slug) {
		setters.setModeToDelete({
			...currentModeToDelete,
			rulesFolderPath: message.rulesFolderPath,
		})
		setters.setShowDeleteConfirm(true)
	}
}

export function createMessageHandler(
	refs: MessageHandlerRefs,
	setters: SystemPromptSetters &
		ExportSetters &
		ImportSetters &
		CheckRulesSetters &
		DeleteModeCheckSetters & {
			setModeToDelete: (v: { slug: string; name: string; rulesFolderPath?: string } | null) => void
		},
) {
	return (event: MessageEvent) => {
		const data = event.data
		if (!data) return
		const type = data.type
		if (type === "systemPrompt") {
			handleSystemPrompt(data, setters)
		} else if (type === "exportModeResult") {
			handleExportModeResult(data, setters)
		} else if (type === "importModeResult") {
			handleImportModeResult(data, refs, setters)
		} else if (type === "checkRulesDirectoryResult") {
			handleCheckRulesDirectoryResult(data, setters)
		} else if (type === "deleteCustomModeCheck") {
			handleDeleteCustomModeCheck(data, refs, setters)
		}
	}
}
