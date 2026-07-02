import { parsePatch, type ParsedDiff } from "diff"

export interface DiffLine {
	oldLineNum: number | null
	newLineNum: number | null
	type: "context" | "addition" | "deletion" | "gap"
	content: string
	hiddenCount?: number
}

/**
 * Parse a unified diff string into a flat list of renderable lines with
 * line numbers, addition/deletion/context flags, and compact "gap" separators
 * between hunks.
 */
function findTargetPatch(patches: ParsedDiff[], filePath: string): ParsedDiff | undefined {
	return patches.find((p) =>
		[p.newFileName, p.oldFileName].some(
			(n) => typeof n === "string" && (n === filePath || n.endsWith("/" + filePath)),
		),
	)
}

function insertGapIfNeeded(
	lines: DiffLine[],
	prevHunk: ParsedDiff["hunks"][number] | null,
	hunk: ParsedDiff["hunks"][number],
): void {
	if (!prevHunk) return

	const gapNew = hunk.newStart - (prevHunk.newStart + prevHunk.newLines)
	const gapOld = hunk.oldStart - (prevHunk.oldStart + prevHunk.oldLines)
	const hidden = Math.max(gapNew, gapOld)
	if (hidden > 0) {
		lines.push({
			oldLineNum: null,
			newLineNum: null,
			type: "gap",
			content: "",
			hiddenCount: hidden,
		})
	}
}

function createDiffLine(
	raw: string,
	oldLine: number,
	newLine: number,
): { line: DiffLine; oldInc: number; newInc: number } {
	const firstChar = raw[0]
	const content = raw.slice(1)

	if (firstChar === "-") {
		return {
			line: { oldLineNum: oldLine, newLineNum: null, type: "deletion", content },
			oldInc: 1,
			newInc: 0,
		}
	}
	if (firstChar === "+") {
		return {
			line: { oldLineNum: null, newLineNum: newLine, type: "addition", content },
			oldInc: 0,
			newInc: 1,
		}
	}
	return {
		line: { oldLineNum: oldLine, newLineNum: newLine, type: "context", content },
		oldInc: 1,
		newInc: 1,
	}
}

function resolveTargetPatch(patches: ParsedDiff[], filePath?: string): ParsedDiff | undefined {
	if (!filePath) return patches[0]
	return findTargetPatch(patches, filePath) ?? patches[0]
}

export function parseUnifiedDiff(source: string, filePath?: string): DiffLine[] {
	if (!source) return []

	try {
		const patches = parsePatch(source)
		if (!patches || patches.length === 0) return []

		const patch = resolveTargetPatch(patches, filePath)
		if (!patch || !patch.hunks) return []

		const lines: DiffLine[] = []
		let prevHunk: ParsedDiff["hunks"][number] | null = null

		for (const hunk of patch.hunks) {
			insertGapIfNeeded(lines, prevHunk, hunk)

			let oldLine = hunk.oldStart
			let newLine = hunk.newStart

			if (hunk.lines) {
				hunk.lines.forEach((raw) => {
					const result = createDiffLine(raw as string, oldLine, newLine)
					lines.push(result.line)
					oldLine += result.oldInc
					newLine += result.newInc
				})
			}

			prevHunk = hunk
		}

		return lines
	} catch {
		// swallow parse errors and render nothing rather than breaking the UI
		return []
	}
}
