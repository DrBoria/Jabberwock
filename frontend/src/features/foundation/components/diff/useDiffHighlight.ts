import { useState, useEffect } from "react"
import { highlightHunks } from "@src/utils/text/highlighter"
import type { Hunk } from "./diffView.utils"

export const useDiffHighlight = (
	hunks: Hunk[],
	shouldHighlight: boolean,
	normalizedLang: string,
	isLightTheme: boolean,
	filePath?: string,
): Hunk[] => {
	const [processedHunks, setProcessedHunks] = useState<Hunk[]>(hunks)

	useEffect(() => {
		if (!shouldHighlight) {
			setProcessedHunks(hunks)
			return
		}

		const processHunks = async () => {
			const processed: Hunk[] = []

			for (let i = 0; i < hunks.length; i++) {
				const hunk = hunks[i]
				try {
					const highlighted = await highlightHunks(
						hunk.oldText,
						hunk.newText,
						normalizedLang,
						isLightTheme ? "light" : "dark",
						i,
						filePath,
					)
					processed.push({
						...hunk,
						highlightedOldLines: highlighted.oldLines,
						highlightedNewLines: highlighted.newLines,
					})
				} catch {
					processed.push(hunk)
				}
			}

			setProcessedHunks(processed)
		}

		processHunks()
	}, [hunks, shouldHighlight, normalizedLang, isLightTheme, filePath])

	return processedHunks
}
