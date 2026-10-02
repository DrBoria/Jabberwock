import { useState, useCallback } from "react"

import { useCopyToClipboard } from "@sections/dndTextArea/utils/clipboard/main"

/**
 * Shared copy-button logic for error rows: copy text with feedback and expose a
 * transient "copied" flag (for the check/copy icon swap) that auto-resets.
 */
export const useCopyButton = (text: string, feedbackDuration = 1000) => {
	const [showCopySuccess, setShowCopySuccess] = useState(false)
	const { copyWithFeedback } = useCopyToClipboard(feedbackDuration)

	const handleCopy = useCallback(
		async (e: React.MouseEvent) => {
			e.stopPropagation()
			const success = await copyWithFeedback(text)
			if (success) {
				setShowCopySuccess(true)
				setTimeout(() => setShowCopySuccess(false), feedbackDuration)
			}
		},
		[text, copyWithFeedback, feedbackDuration],
	)

	return { showCopySuccess, handleCopy }
}
