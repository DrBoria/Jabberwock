import type { DiffLine } from "@src/utils/parser/parseUnifiedDiff"

export interface Hunk {
	lines: DiffLine[]
	oldText: string
	newText: string
	highlightedOldLines?: React.ReactNode[]
	highlightedNewLines?: React.ReactNode[]
}

export const getHighlightOrFallback = (
	highlight: React.ReactNode | undefined,
	fallback: React.ReactNode,
): React.ReactNode => {
	if (highlight) return highlight
	return fallback
}

export const extractHunkText = (lines: DiffLine[]) => {
	const oldLines: string[] = []
	const newLines: string[] = []

	for (const line of lines) {
		if (line.type === "deletion" || line.type === "context") {
			oldLines.push(line.content)
		}
		if (line.type === "addition" || line.type === "context") {
			newLines.push(line.content)
		}
	}

	return { oldText: oldLines.join("\n"), newText: newLines.join("\n") }
}

export const buildHunks = (diffLines: DiffLine[]): Hunk[] => {
	const result: Hunk[] = []
	let currentHunk: DiffLine[] = []

	for (const line of diffLines) {
		if (line.type === "gap") {
			if (currentHunk.length > 0) {
				const { oldText, newText } = extractHunkText(currentHunk)
				result.push({ lines: [...currentHunk], oldText, newText })
			}
			currentHunk = [line]
		} else {
			currentHunk.push(line)
		}
	}

	if (currentHunk.length > 0 && currentHunk.some((line) => line.type !== "gap")) {
		const { oldText, newText } = extractHunkText(currentHunk)
		result.push({ lines: [...currentHunk], oldText, newText })
	}

	return result
}
