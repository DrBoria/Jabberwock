import { useCallback, useEffect } from "react"
import { getAllModes } from "@shared/modes"

/**
 * Handles mode-switching keyboard shortcuts:
 * - Cmd/Ctrl + . → next mode
 * - Cmd/Ctrl + Shift + . → previous mode
 *
 * Scroll-intent keyboard events (PageUp, Home, ArrowUp) are handled
 * separately by useScrollLifecycle.
 */
export function useKeyboardShortcuts(mode: string, customModes: any[], switchToMode: (slug: string) => void) {
	const switchToNextMode = useCallback(() => {
		const allModes = getAllModes(customModes)
		const currentIndex = allModes.findIndex((m) => m.slug === mode)
		const nextIndex = (currentIndex + 1) % allModes.length
		switchToMode(allModes[nextIndex].slug)
	}, [mode, customModes, switchToMode])

	const switchToPreviousMode = useCallback(() => {
		const allModes = getAllModes(customModes)
		const currentIndex = allModes.findIndex((m) => m.slug === mode)
		const prevIndex = (currentIndex - 1 + allModes.length) % allModes.length
		switchToMode(allModes[prevIndex].slug)
	}, [mode, customModes, switchToMode])

	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key === ".") {
				event.preventDefault()
				if (event.shiftKey) {
					switchToPreviousMode()
				} else {
					switchToNextMode()
				}
			}
		},
		[switchToNextMode, switchToPreviousMode],
	)

	useEffect(() => {
		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [handleKeyDown])
}
