/**
 * Indentation-based semantic code block extraction.
 *
 * Inspired by Codex's indentation mode, this module extracts meaningful code blocks
 * based on indentation hierarchy rather than arbitrary line ranges.
 *
 * The algorithm uses bidirectional expansion from an anchor line:
 * 1. Parse the file to determine indentation level of each line
 * 2. Compute effective indents (blank lines inherit previous non-blank line's indent)
 * 3. Expand up and down from anchor simultaneously
 * 4. Apply sibling exclusion counters to limit scope
 * 5. Trim empty lines from edges
 * 6. Apply line limit
 */

import { MAX_LINE_LENGTH } from "@features/settings/context/tools/native-tools/r/read_file"

import type { IndentationReadOptions, IndentationReadResult, LineRecord } from "./types"
import {
	BLOCK_START_PATTERNS,
	INDENT_SIZE,
	TAB_WIDTH,
	buildSingleLineResult,
	calculateFinalLimit,
	calculateMinIndent,
	computeIncludedRanges,
	expandFromAnchor,
	trimEmptyLines,
	validateAnchorLine,
} from "./helpers"

export function parseLines(content: string): LineRecord[] {
	const lines = content.split("\n")
	return lines.map((line, index) => {
		const trimmed = line.trimStart()
		const leadingWhitespace = line.length - trimmed.length
		let indentSpaces = 0
		for (let i = 0; i < leadingWhitespace; i++) {
			if (line[i] === "\t") {
				indentSpaces += TAB_WIDTH
			} else {
				indentSpaces += 1
			}
		}
		const indentLevel = Math.floor(indentSpaces / INDENT_SIZE)
		const isBlank = trimmed.length === 0
		const isBlockStart = !isBlank && BLOCK_START_PATTERNS.some((pattern) => pattern.test(line))
		return {
			lineNumber: index + 1,
			content: line,
			indentLevel,
			isBlank,
			isBlockStart,
		}
	})
}

export function computeEffectiveIndents(lines: LineRecord[]): number[] {
	const effective: number[] = []
	let previousIndent = 0
	for (const line of lines) {
		if (line.isBlank) {
			effective.push(previousIndent)
		} else {
			previousIndent = line.indentLevel
			effective.push(previousIndent)
		}
	}
	return effective
}

export function formatWithLineNumbers(lines: LineRecord[], maxLineLength: number = MAX_LINE_LENGTH): string {
	if (lines.length === 0) return ""
	const maxLineNumWidth = String(lines[lines.length - 1]?.lineNumber || 1).length
	return lines
		.map((line) => {
			const lineNum = String(line.lineNumber).padStart(maxLineNumWidth, " ")
			let content = line.content
			if (content.length > maxLineLength) {
				content = content.substring(0, maxLineLength - 3) + "..."
			}
			return `${lineNum} | ${content}`
		})
		.join("\n")
}

export function readWithIndentation(content: string, options: IndentationReadOptions): IndentationReadResult {
	const { anchorLine, maxLevels = 0, includeSiblings = false, includeHeader = true, limit = 2000, maxLines } = options
	const lines = parseLines(content)
	const totalLines = lines.length
	const validationError = validateAnchorLine(anchorLine, totalLines)
	if (validationError) {
		return validationError
	}
	const anchorIdx = anchorLine - 1
	const effectiveIndents = computeEffectiveIndents(lines)
	const anchorIndent = effectiveIndents[anchorIdx]
	const minIndent = calculateMinIndent(maxLevels, anchorIndent)
	const finalLimit = calculateFinalLimit(limit, maxLines, totalLines)
	if (finalLimit === 1) {
		return buildSingleLineResult(lines[anchorIdx], anchorLine, totalLines)
	}
	const result = expandFromAnchor(
		lines,
		effectiveIndents,
		anchorIdx,
		minIndent,
		finalLimit,
		includeSiblings,
		includeHeader,
	)
	trimEmptyLines(result.lines)
	const wasTruncated = result.lines.length >= finalLimit || result.i >= 0 || result.j < lines.length
	const formattedContent = formatWithLineNumbers(result.lines)
	const includedRanges = computeIncludedRanges(result.lines)
	return {
		content: formattedContent,
		includedRanges,
		totalLines,
		returnedLines: result.lines.length,
		wasTruncated: wasTruncated && result.lines.length < totalLines,
	}
}

export function readWithSlice(content: string, offset: number = 0, limit: number = 2000): IndentationReadResult {
	const lines = parseLines(content)
	const totalLines = lines.length
	if (offset < 0) offset = 0
	if (offset >= totalLines) {
		return {
			content: `Error: offset ${offset} is beyond file end (${totalLines} lines)`,
			includedRanges: [],
			totalLines,
			returnedLines: 0,
			wasTruncated: false,
		}
	}
	const endIdx = Math.min(offset + limit, totalLines)
	const selectedLines = lines.slice(offset, endIdx)
	const wasTruncated = endIdx < totalLines
	const formattedContent = formatWithLineNumbers(selectedLines)
	return {
		content: formattedContent,
		includedRanges: [[offset + 1, endIdx]],
		totalLines,
		returnedLines: selectedLines.length,
		wasTruncated,
	}
}
