import { useCallback, useRef, useState } from "react"
import useSound from "use-sound"
import type { AudioType } from "@jabberwock/types"
import { getAudioVolume } from "../chat-area/message-area.utils"

export const useMessageSound = (soundVolume: unknown, soundEnabled: boolean) => {
	const [audioBaseUri] = useState(() => (window as Window & { AUDIO_BASE_URI?: string }).AUDIO_BASE_URI || "")
	const audioVolume = getAudioVolume(soundVolume)
	const [playNotification] = useSound(`${audioBaseUri}/notification.wav`, {
		volume: audioVolume,
		soundEnabled,
		interrupt: true,
	})
	const [playCelebration] = useSound(`${audioBaseUri}/celebration.wav`, {
		volume: audioVolume,
		soundEnabled,
		interrupt: true,
	})
	const [playProgressLoop] = useSound(`${audioBaseUri}/progress_loop.wav`, {
		volume: audioVolume,
		soundEnabled,
		interrupt: true,
	})
	const lastPlayedRef = useRef<Record<string, number>>({})
	const playSound = useCallback(
		(audioType: AudioType) => {
			if (!soundEnabled) return
			const now = Date.now()
			if (now - (lastPlayedRef.current[audioType] ?? 0) < 100) return
			lastPlayedRef.current[audioType] = now
			if (audioType === "notification") playNotification()
			else if (audioType === "celebration") playCelebration()
			else if (audioType === "progress_loop") playProgressLoop()
		},
		[soundEnabled, playNotification, playCelebration, playProgressLoop],
	)
	return { playSound, audioBaseUri }
}
