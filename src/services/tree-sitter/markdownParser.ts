/**
 * Markdown parser that returns headers and section line ranges
 * This is a special case implementation that doesn't use tree-sitter
 * but is compatible with the parseFile function's capture processing
 */

import { QueryCapture } from "web-tree-sitter"

/**
 * Interface to mimic tree-sitter node structure
 */
interface MockNode {
	startPosition: {
		row: number
	}
	endPosition: {
		row: number
	}
	text: string
	parent?: MockNode
}

/**
 * Interface to mimic tree-sitter capture structure
 */
interface MockCapture {
	node: MockNode
	name: string
	patternIndex: number
}

/**
 * Parse a markdown file and extract headers and section line ranges
 *
 * @param content - The content of the markdown file
 * @returns An array of mock captures compatible with tree-sitter captures
 */
/**
 * Create captures for an ATX header (# Header)
 */
function _createAtxCaptures(line: string, row: number, atxHeaderRegex: RegExp): MockCapture[] {
	const atxMatch = line.match(atxHeaderRegex)
	if (!atxMatch) return []

	const level = atxMatch[1].length
	const text = atxMatch[2].trim()

	const node: MockNode = {
		startPosition: { row },
		endPosition: { row },
		text,
	}

	return [
		{ node, name: `name.definition.header.h${level}`, patternIndex: 0 },
		{ node, name: `definition.header.h${level}`, patternIndex: 0 },
	]
}

/**
 * Create captures for setext headers (underlined headers)
 */
function _createSetextCaptures(
	line: string,
	lines: string[],
	row: number,
	setextH1Regex: RegExp,
	setextH2Regex: RegExp,
	validSetextTextRegex: RegExp,
): MockCapture[] {
	if (row <= 0) return []

	if (setextH1Regex.test(line) && validSetextTextRegex.test(lines[row - 1])) {
		const text = lines[row - 1].trim()
		const node: MockNode = {
			startPosition: { row: row - 1 },
			endPosition: { row },
			text,
		}
		return [
			{ node, name: "name.definition.header.h1", patternIndex: 0 },
			{ node, name: "definition.header.h1", patternIndex: 0 },
		]
	}

	if (setextH2Regex.test(line) && validSetextTextRegex.test(lines[row - 1])) {
		const text = lines[row - 1].trim()
		const node: MockNode = {
			startPosition: { row: row - 1 },
			endPosition: { row },
			text,
		}
		return [
			{ node, name: "name.definition.header.h2", patternIndex: 0 },
			{ node, name: "definition.header.h2", patternIndex: 0 },
		]
	}

	return []
}

/**
 * Calculate section ranges by updating end positions
 */
function _calculateSectionRanges(captures: MockCapture[], lines: string[]): QueryCapture[] {
	if (captures.length === 0) {
		return []
	}

	captures.sort((a, b) => a.node.startPosition.row - b.node.startPosition.row)

	const headerCaptures: MockCapture[][] = []
	for (let i = 0; i < captures.length; i += 2) {
		if (i + 1 < captures.length) {
			headerCaptures.push([captures[i], captures[i + 1]])
		} else {
			headerCaptures.push([captures[i]])
		}
	}

	for (let i = 0; i < headerCaptures.length; i++) {
		const headerPair = headerCaptures[i]

		if (i < headerCaptures.length - 1) {
			const nextHeaderStartRow = headerCaptures[i + 1][0].node.startPosition.row
			headerPair.forEach((capture) => {
				capture.node.endPosition.row = nextHeaderStartRow - 1
			})
		} else {
			headerPair.forEach((capture) => {
				capture.node.endPosition.row = lines.length - 1
			})
		}
	}

	return headerCaptures.flat() as QueryCapture[]
}

export function parseMarkdown(content: string): QueryCapture[] {
	if (!content || content.trim() === "") {
		return []
	}

	const lines = content.split("\n")
	const captures: MockCapture[] = []

	const atxHeaderRegex = /^(#{1,6})\s+(.+)$/
	const setextH1Regex = /^={3,}\s*$/
	const setextH2Regex = /^-{3,}\s*$/
	const validSetextTextRegex = /^\s*[^#<>!\[\]`\t]+[^\n]$/

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]

		const atxCaptures = _createAtxCaptures(line, i, atxHeaderRegex)
		if (atxCaptures.length > 0) {
			captures.push(...atxCaptures)
			continue
		}

		const setextCaptures = _createSetextCaptures(line, lines, i, setextH1Regex, setextH2Regex, validSetextTextRegex)
		if (setextCaptures.length > 0) {
			captures.push(...setextCaptures)
		}
	}

	return _calculateSectionRanges(captures, lines)
}

/**
 * Format markdown captures into the same string format as parseFile
 * This is used for backward compatibility
 *
 * @param captures - The array of query captures
 * @param minSectionLines - Minimum number of lines for a section to be included
 * @returns A formatted string with headers and section line ranges
 */
export function formatMarkdownCaptures(captures: QueryCapture[], minSectionLines: number = 4): string | null {
	if (captures.length === 0) {
		return null
	}

	let formattedOutput = ""

	// Process only the definition captures (every other capture)
	for (let i = 1; i < captures.length; i += 2) {
		const capture = captures[i]
		const startLine = capture.node.startPosition.row
		const endLine = capture.node.endPosition.row

		// Only include sections that span at least minSectionLines lines
		const sectionLength = endLine - startLine + 1
		if (sectionLength >= minSectionLines) {
			// Extract header level from the name
			let headerLevel = 1

			// Check if the name contains a header level (e.g., 'definition.header.h2')
			const headerMatch = capture.name.match(/\.h(\d)$/)
			if (headerMatch && headerMatch[1]) {
				headerLevel = parseInt(headerMatch[1])
			}

			const headerPrefix = "#".repeat(headerLevel)

			// Format: startLine--endLine | # Header Text
			formattedOutput += `${startLine}--${endLine} | ${headerPrefix} ${capture.node.text}\n`
		}
	}

	return formattedOutput.length > 0 ? formattedOutput : null
}
