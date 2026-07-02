import pdf from "pdf-parse/lib/pdf-parse"
import mammoth from "mammoth"
import { virtualWorkspace } from "@features/foundation/time-machine/VirtualWorkspace"
import { extractTextFromXLSX } from "./from-xlsx"

export async function extractTextFromPDF(filePath: string): Promise<string> {
	const dataBuffer = await virtualWorkspace.readBuffer(filePath)
	const data = await pdf(dataBuffer)
	return addLineNumbers(data.text)
}

export async function extractTextFromDOCX(filePath: string): Promise<string> {
	const dataBuffer = await virtualWorkspace.readBuffer(filePath)
	const result = await mammoth.extractRawText({ arrayBuffer: dataBuffer.buffer as ArrayBuffer })
	return addLineNumbers(result.value)
}

export async function extractTextFromIPYNB(filePath: string): Promise<string> {
	const data = await virtualWorkspace.readFile(filePath)
	const notebook = JSON.parse(data)
	let extractedText = ""
	for (const cell of notebook.cells) {
		if ((cell.cell_type === "markdown" || cell.cell_type === "code") && cell.source) {
			extractedText += cell.source.join("\n") + "\n"
		}
	}
	return addLineNumbers(extractedText)
}

export const SUPPORTED_BINARY_FORMATS: Record<string, (filePath: string) => Promise<string>> = {
	".pdf": extractTextFromPDF,
	".docx": extractTextFromDOCX,
	".ipynb": extractTextFromIPYNB,
	".xlsx": extractTextFromXLSX,
}

export function addLineNumbers(content: string, startLine: number = 1): string {
	if (content === "") {
		return startLine === 1 ? "" : `${startLine} | \n`
	}
	const lines = content.split("\n")
	const lastLineEmpty = lines[lines.length - 1] === ""
	if (lastLineEmpty) {
		lines.pop()
	}
	const maxLineNumberWidth = String(startLine + lines.length - 1).length
	const numberedContent = lines
		.map((line, index) => {
			const lineNumber = String(startLine + index).padStart(maxLineNumberWidth, " ")
			return `${lineNumber} | ${line}`
		})
		.join("\n")
	return numberedContent + "\n"
}

export function everyLineHasLineNumbers(content: string): boolean {
	const lines = content.split(/\r?\n/)
	return lines.length > 0 && lines.every((line) => /^\s*\d+\s+\|(?!\|)/.test(line))
}

export function stripLineNumbers(content: string, aggressive: boolean = false): string {
	const lines = content.split(/\r?\n/)
	const processedLines = lines.map((line) => {
		const match = aggressive ? line.match(/^\s*(?:\d+\s)?\|\s(.*)$/) : line.match(/^\s*\d+\s+\|(?!\|)\s?(.*)$/)
		return match ? match[1] : line
	})
	const lineEnding = content.includes("\r\n") ? "\r\n" : "\n"
	let result = processedLines.join(lineEnding)
	if (content.endsWith(lineEnding)) {
		if (!result.endsWith(lineEnding)) {
			result += lineEnding
		}
	}
	return result
}

function truncateByCharacterLimit(content: string, characterLimit: number): string {
	const beforeLimit = Math.floor(characterLimit * 0.2)
	const afterLimit = characterLimit - beforeLimit
	const startSection = content.slice(0, beforeLimit)
	const endSection = content.slice(-afterLimit)
	const omittedChars = content.length - characterLimit
	return startSection + `\n[...${omittedChars} characters omitted...]\n` + endSection
}

function countLines(content: string): number {
	let count = 0
	let pos = -1
	while ((pos = content.indexOf("\n", pos + 1)) !== -1) {
		count++
	}
	return count + 1
}

function truncateByLineLimit(content: string, lineLimit: number, totalLines: number): string {
	const beforeLimit = Math.floor(lineLimit * 0.2)
	const afterLimit = lineLimit - beforeLimit
	let startEndPos = -1
	let lineCount = 0
	let pos = 0
	while (lineCount < beforeLimit && (pos = content.indexOf("\n", pos)) !== -1) {
		startEndPos = pos
		lineCount++
		pos++
	}
	let endStartPos = content.length
	lineCount = 0
	pos = content.length
	while (lineCount < afterLimit && (pos = content.lastIndexOf("\n", pos - 1)) !== -1) {
		endStartPos = pos + 1
		lineCount++
	}
	const omittedLines = totalLines - lineLimit
	return (
		content.slice(0, startEndPos + 1) + `\n[...${omittedLines} lines omitted...]\n\n` + content.slice(endStartPos)
	)
}

export function truncateOutput(content: string, lineLimit?: number, characterLimit?: number): string {
	if (!lineLimit && !characterLimit) {
		return content
	}
	if (characterLimit && content.length > characterLimit) {
		return truncateByCharacterLimit(content, characterLimit)
	}
	if (!lineLimit) {
		return content
	}
	const totalLines = countLines(content)
	if (totalLines <= lineLimit) {
		return content
	}
	return truncateByLineLimit(content, lineLimit, totalLines)
}

function flushRepeat(result: string, prevLine: string, repeatCount: number): string {
	if (repeatCount <= 0) {
		return result + prevLine
	}
	const compressionDesc = `<previous line repeated ${repeatCount} additional times>\n`
	if (compressionDesc.length < prevLine.length * (repeatCount + 1)) {
		return result + prevLine + compressionDesc
	}
	let newResult = result
	for (let i = 0; i <= repeatCount; i++) {
		newResult += prevLine
	}
	return newResult
}

export function applyRunLengthEncoding(content: string): string {
	if (!content) {
		return content
	}
	let result = ""
	let pos = 0
	let repeatCount = 0
	let prevLine: string | null = null
	while (pos < content.length) {
		const nextNewlineIdx = content.indexOf("\n", pos)
		const currentLine = nextNewlineIdx === -1 ? content.slice(pos) : content.slice(pos, nextNewlineIdx + 1)
		if (prevLine === null) {
			prevLine = currentLine
		} else if (currentLine === prevLine) {
			repeatCount++
		} else {
			result = flushRepeat(result, prevLine, repeatCount)
			repeatCount = 0
			prevLine = currentLine
		}
		pos = nextNewlineIdx === -1 ? content.length : nextNewlineIdx + 1
	}
	if (prevLine !== null) {
		result = flushRepeat(result, prevLine, repeatCount)
	}
	return result
}
