import { useCallback, useEffect, useRef } from "react"
import useSound from "use-sound"
import { getAllModes } from "@shared/modes"
import type { AudioType } from "@jabberwock/types"
import { rootStore } from "@src/features/store"
import { getVolume } from "./chat-view-utils"

export const useSoundEffects = (audioBaseUri: string, soundEnabled: boolean, soundVolume: unknown) => {
	const volume = getVolume(soundVolume)
	const [playNotification] = useSound(`${audioBaseUri}/notification.wav`, { volume, soundEnabled, interrupt: true })
	const [playCelebration] = useSound(`${audioBaseUri}/celebration.wav`, { volume, soundEnabled, interrupt: true })
	const [playProgressLoop] = useSound(`${audioBaseUri}/progress_loop.wav`, { volume, soundEnabled, interrupt: true })
	const lastPlayedRef = useRef<Record<string, number>>({})

	const playSound = useCallback(
		(audioType: AudioType) => {
			if (!soundEnabled) return
			const now = Date.now()
			const lastPlayed = lastPlayedRef.current[audioType] ?? 0
			if (now - lastPlayed < 100) return
			lastPlayedRef.current[audioType] = now
			switch (audioType) {
				case "notification":
					playNotification()
					break
				case "celebration":
					playCelebration()
					break
				case "progress_loop":
					playProgressLoop()
					break
			}
		},
		[soundEnabled, playNotification, playCelebration, playProgressLoop],
	)

	return { playSound }
}

export const useModeSwitch = (mode: string | undefined, customModes: Parameters<typeof getAllModes>[0]) => {
	const switchToMode = useCallback((modeSlug: string): void => {
		rootStore.setMode(modeSlug)
		rootStore.chat.switchMode(modeSlug)
	}, [])

	const switchToNextMode = useCallback(() => {
		const allModes = getAllModes(customModes)
		const currentModeIndex = allModes.findIndex((m) => m.slug === mode)
		const nextModeIndex = (currentModeIndex + 1) % allModes.length
		switchToMode(allModes[nextModeIndex].slug)
	}, [mode, customModes, switchToMode])

	const switchToPreviousMode = useCallback(() => {
		const allModes = getAllModes(customModes)
		const currentModeIndex = allModes.findIndex((m) => m.slug === mode)
		const previousModeIndex = (currentModeIndex - 1 + allModes.length) % allModes.length
		switchToMode(allModes[previousModeIndex].slug)
	}, [mode, customModes, switchToMode])

	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key === ".") {
				event.preventDefault()
				if (event.shiftKey) switchToPreviousMode()
				else switchToNextMode()
			}
		},
		[switchToNextMode, switchToPreviousMode],
	)

	useEffect(() => {
		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [handleKeyDown])

	return { switchToMode, switchToNextMode, switchToPreviousMode }
}
