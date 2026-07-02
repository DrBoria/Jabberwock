import { QueryCapture } from "web-tree-sitter"
import { getMinComponentLines } from "./config"

interface CaptureInfo {
	startLine: number
	endLine: number
	lineKey: string
}

function resolveCaptureInfo(capture: QueryCapture, processedLines: Set<string>): CaptureInfo | null {
	const { node, name } = capture

	if (!name.includes("definition") && !name.includes("name")) {
		return null
	}

	const definitionNode = name.includes("name") ? node.parent : node
	if (!definitionNode) return null

	const startLine = definitionNode.startPosition.row
	const endLine = definitionNode.endPosition.row
	const lineCount = endLine - startLine + 1

	if (lineCount < getMinComponentLines()) {
		return null
	}

	const lineKey = `${startLine}-${endLine}`

	if (processedLines.has(lineKey)) {
		return null
	}

	return { startLine, endLine, lineKey }
}

function isNotHtmlElement(line: string, needsHtmlFiltering: boolean): boolean {
	if (!needsHtmlFiltering) return true
	const HTML_ELEMENTS = /^[^A-Z]*<\/?(?:div|span|button|input|h[1-6]|p|a|img|ul|li|form)\b/
	const trimmedLine = line.trim()
	return !HTML_ELEMENTS.test(trimmedLine)
}

function processDefinitionOutput(
	capture: QueryCapture,
	lines: string[],
	startLine: number,
	endLine: number,
	lineKey: string,
	needsHtmlFiltering: boolean,
	processedLines: Set<string>,
): string | null {
	const { node, name } = capture

	if (name.includes("name.definition")) {
		const componentName = node.text
		if (!componentName) return null

		processedLines.add(lineKey)
		return `${startLine + 1}--${endLine + 1} | ${lines[startLine]}\n`
	}

	const startLineContent = lines[startLine].trim()
	if (!isNotHtmlElement(startLineContent, needsHtmlFiltering)) {
		return null
	}

	processedLines.add(lineKey)
	let result = `${startLine + 1}--${endLine + 1} | ${lines[startLine]}\n`

	if (node.parent && node.parent.lastChild) {
		const contextEnd = node.parent.lastChild.endPosition.row
		const contextSpan = contextEnd - node.parent.startPosition.row + 1

		if (contextSpan >= getMinComponentLines()) {
			const rangeKey = `${node.parent.startPosition.row}-${contextEnd}`
			if (!processedLines.has(rangeKey)) {
				processedLines.add(rangeKey)
				result += `${node.parent.startPosition.row + 1}--${contextEnd + 1} | ${lines[node.parent.startPosition.row]}\n`
			}
		}
	}

	return result
}

export function processCaptures(captures: QueryCapture[], lines: string[], language: string): string | null {
	if (captures.length === 0) {
		return null
	}

	const needsHtmlFiltering = ["jsx", "tsx"].includes(language)

	captures.sort((a, b) => a.node.startPosition.row - b.node.startPosition.row)

	const processedLines = new Set<string>()
	let formattedOutput = ""

	captures.forEach((capture) => {
		const info = resolveCaptureInfo(capture, processedLines)
		if (info === null) return

		const output = processDefinitionOutput(
			capture,
			lines,
			info.startLine,
			info.endLine,
			info.lineKey,
			needsHtmlFiltering,
			processedLines,
		)
		if (output !== null) {
			formattedOutput += output
		}
	})

	if (formattedOutput.length > 0) {
		return formattedOutput
	}

	return null
}
