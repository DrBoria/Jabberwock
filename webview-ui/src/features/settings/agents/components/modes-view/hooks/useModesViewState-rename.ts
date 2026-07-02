import { useState, useRef, useCallback } from "react"
import type { ModeConfig } from "@jabberwock/types"

export interface UseRenameModeResult {
	isRenamingMode: boolean
	renameInputValue: string
	renameInputRef: React.RefObject<HTMLInputElement | null>
	localRenames: Record<string, string>
	displayModes: ModeConfig[]
	handleStartRenameMode: () => void
	handleCancelRenameMode: () => void
	handleSaveRenameMode: () => void
	setRenameInputValue: (value: string) => void
}

export function useRenameMode(
	visualMode: string,
	customModes: ModeConfig[] | undefined,
	modes: ModeConfig[],
	updateCustomMode: (slug: string, config: ModeConfig) => void,
	findModeBySlug: (searchSlug: string, m: ModeConfig[] | undefined) => ModeConfig | undefined,
): UseRenameModeResult {
	const [isRenamingMode, setIsRenamingMode] = useState(false)
	const [renameInputValue, setRenameInputValue] = useState("")
	const renameInputRef = useRef<HTMLInputElement>(null)
	const [localRenames, setLocalRenames] = useState<Record<string, string>>({})
	const displayModes = (modes || []).map((m) => (localRenames[m.slug] ? { ...m, name: localRenames[m.slug] } : m))

	const handleStartRenameMode = useCallback(() => {
		const customMode = findModeBySlug(visualMode, customModes)
		if (customMode) {
			setIsRenamingMode(true)
			setRenameInputValue(customMode.name)
		}
	}, [visualMode, customModes, findModeBySlug])

	const handleCancelRenameMode = useCallback(() => {
		setIsRenamingMode(false)
		setRenameInputValue("")
	}, [])

	const handleSaveRenameMode = useCallback(() => {
		const customMode = findModeBySlug(visualMode, customModes)
		const trimmed = renameInputValue.trim()
		if (!customMode || !trimmed) {
			setIsRenamingMode(false)
			return
		}
		if (modes.some((m) => m.name.toLowerCase() === trimmed.toLowerCase() && m.slug !== customMode.slug)) return
		updateCustomMode(visualMode, { ...customMode, name: trimmed, source: customMode.source || "global" })
		setLocalRenames((prev) => ({ ...prev, [visualMode]: trimmed }))
		setIsRenamingMode(false)
	}, [visualMode, customModes, renameInputValue, modes, updateCustomMode, findModeBySlug])

	return {
		isRenamingMode,
		renameInputValue,
		renameInputRef,
		localRenames,
		displayModes,
		handleStartRenameMode,
		handleCancelRenameMode,
		handleSaveRenameMode,
		setRenameInputValue,
	}
}
