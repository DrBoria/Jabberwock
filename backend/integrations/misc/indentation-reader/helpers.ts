import type { ExpandStepResult, IndentationReadResult, LineRecord } from "./types"

export const INDENT_SIZE = 4
export const TAB_WIDTH = 4

export const BLOCK_START_PATTERNS = [/:\s*$/, /\{\s*$/, /=>\s*\{?\s*$/, /\bthen\s*$/, /\bdo\s*$/]

export const HEADER_PATTERNS = [
	/^import\s/,
	/^from\s.*import/,
	/^const\s.*=\s*require/,
	/^#!/,
	/^\/\*/,
	/^\*/,
	/^\s*\*\//,
	/^\/\//,
	/^#(?!include)/,
	/^"""/,
	/^'''/,
	/^use\s/,
	/^package\s/,
	/^require\s/,
	/^@/,
	/^"use\s/,
]

export const COMMENT_PREFIXES = ["#", "//", "--", "/*", "*", "'''", '"""']

function isComment(line: LineRecord): boolean {
	const trimmed = line.content.trim()
	return COMMENT_PREFIXES.some((prefix) => trimmed.startsWith(prefix))
}

export function trimEmptyLines(lines: LineRecord[]): void {
	while (lines.length > 0 && lines[0].isBlank) {
		lines.shift()
	}
	while (lines.length > 0 && lines[lines.length - 1].isBlank) {
		lines.pop()
	}
}

export function computeIncludedRanges(lines: LineRecord[]): Array<[number, number]> {
	if (lines.length === 0) return []
	const ranges: Array<[number, number]> = []
	let rangeStart = lines[0].lineNumber
	let rangeEnd = lines[0].lineNumber
	for (let i = 1; i < lines.length; i++) {
		const lineNum = lines[i].lineNumber
		if (lineNum === rangeEnd + 1) {
			rangeEnd = lineNum
		} else {
			ranges.push([rangeStart, rangeEnd])
			rangeStart = lineNum
			rangeEnd = lineNum
		}
	}
	ranges.push([rangeStart, rangeEnd])
	return ranges
}

export function validateAnchorLine(anchorLine: number, totalLines: number): IndentationReadResult | null {
	if (anchorLine < 1 || anchorLine > totalLines) {
		return {
			content: `Error: anchor_line ${anchorLine} is out of range (1-${totalLines})`,
			includedRanges: [],
			totalLines,
			returnedLines: 0,
			wasTruncated: false,
		}
	}
	return null
}

export function calculateMinIndent(maxLevels: number, anchorIndent: number): number {
	if (maxLevels === 0) return 0
	return Math.max(0, anchorIndent - maxLevels)
}

export function calculateFinalLimit(limit: number, maxLines: number | undefined, totalLines: number): number {
	const guardLimit = maxLines ?? limit
	return Math.min(limit, guardLimit, totalLines)
}

export function buildSingleLineResult(line: LineRecord, anchorLine: number, totalLines: number): IndentationReadResult {
	return {
		content: `${String(line.lineNumber).padStart(String(totalLines).length, " ")} | ${line.content}`,
		includedRanges: [[anchorLine, anchorLine]],
		totalLines,
		returnedLines: 1,
		wasTruncated: totalLines > 1,
	}
}

function tryExpandUp(
	lines: LineRecord[],
	effectiveIndents: number[],
	i: number,
	minIndent: number,
	includeSiblings: boolean,
	includeHeader: boolean,
	result: LineRecord[],
	iMinCount: number,
): ExpandStepResult {
	if (i < 0 || effectiveIndents[i] < minIndent) {
		return { progressed: false, nextI: -1, nextCount: iMinCount }
	}
	result.unshift(lines[i])
	if (effectiveIndents[i] === minIndent && !includeSiblings) {
		const allowHeader = includeHeader && isComment(lines[i])
		if (!allowHeader && iMinCount > 0) {
			result.shift()
			return { progressed: false, nextI: -1, nextCount: iMinCount }
		}
		return { progressed: true, nextI: i - 1, nextCount: iMinCount + 1 }
	}
	return { progressed: true, nextI: i - 1, nextCount: iMinCount }
}

function tryExpandDown(
	lines: LineRecord[],
	effectiveIndents: number[],
	j: number,
	minIndent: number,
	includeSiblings: boolean,
	result: LineRecord[],
	jMinCount: number,
): ExpandStepResult {
	if (j >= lines.length || effectiveIndents[j] < minIndent) {
		return { progressed: false, nextJ: lines.length, nextCount: jMinCount }
	}
	result.push(lines[j])
	if (effectiveIndents[j] === minIndent && !includeSiblings) {
		if (jMinCount > 0) {
			result.pop()
			return { progressed: false, nextJ: lines.length, nextCount: jMinCount }
		}
		return { progressed: true, nextJ: j + 1, nextCount: jMinCount + 1 }
	}
	return { progressed: true, nextJ: j + 1, nextCount: jMinCount }
}

export function expandFromAnchor(
	lines: LineRecord[],
	effectiveIndents: number[],
	anchorIdx: number,
	minIndent: number,
	finalLimit: number,
	includeSiblings: boolean,
	includeHeader: boolean,
): { lines: LineRecord[]; i: number; j: number } {
	const result: LineRecord[] = [lines[anchorIdx]]
	let i = anchorIdx - 1
	let j = anchorIdx + 1
	let iMinCount = 0
	let jMinCount = 0
	while (result.length < finalLimit) {
		const upProgressed = tryExpandUp(
			lines,
			effectiveIndents,
			i,
			minIndent,
			includeSiblings,
			includeHeader,
			result,
			iMinCount,
		)
		i = upProgressed.nextI!
		iMinCount = upProgressed.nextCount
		if (result.length >= finalLimit) break
		const downProgressed = tryExpandDown(lines, effectiveIndents, j, minIndent, includeSiblings, result, jMinCount)
		j = downProgressed.nextJ!
		jMinCount = downProgressed.nextCount
		if (!upProgressed.progressed && !downProgressed.progressed) break
	}
	return { lines: result, i, j }
}
