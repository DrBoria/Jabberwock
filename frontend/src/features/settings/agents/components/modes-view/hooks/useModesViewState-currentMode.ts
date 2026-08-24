import { useState, useEffect, useCallback } from "react"
import type { ModeConfig } from "@jabberwock/types"

export function useModesViewStateCurrentMode(
	visualMode: string,
	customModes: ModeConfig[] | undefined,
	modes: ModeConfig[],
	rename: { isRenamingMode: boolean; renameInputRef: React.RefObject<HTMLInputElement | null> },
	ui: { hasRulesToExport: Record<string, boolean | undefined> },
	checkRulesDirectory: (slug: string) => void,
) {
	const [currentMode, setCurrentMode] = useState<ModeConfig | undefined>(
		() => customModes?.find((m) => m.slug === visualMode) || modes.find((m) => m.slug === visualMode),
	)

	useEffect(() => {
		if (rename.isRenamingMode) {
			const id = setTimeout(() => rename.renameInputRef.current?.focus(), 0)
			return () => clearTimeout(id)
		}
	}, [rename.isRenamingMode, rename.renameInputRef])

	const getCurrentMode = useCallback(
		(): ModeConfig | undefined =>
			customModes?.find((m) => m.slug === visualMode) || modes.find((m) => m.slug === visualMode),
		[visualMode, customModes, modes],
	)

	useEffect(() => {
		setCurrentMode(getCurrentMode())
	}, [getCurrentMode])

	useEffect(() => {
		const cm = getCurrentMode()
		if (cm?.slug && ui.hasRulesToExport[cm.slug] === undefined) checkRulesDirectory(cm.slug)
	}, [getCurrentMode, checkRulesDirectory, ui.hasRulesToExport])

	return { getCurrentMode, currentMode }
}
