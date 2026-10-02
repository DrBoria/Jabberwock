import * as fs from "fs"
import type { TextEdit } from "../../classes/text/TextEdit.ts"
import type { TextDocument, TextLine } from "../../interfaces/document.ts"
import { Range } from "../../classes/types/Range.ts"
import { Position } from "../../classes/types/Position.ts"

export function applyEditsToFile(filePath: string, edits: TextEdit[]): string {
	let content = ""
	try {
		content = fs.readFileSync(filePath, "utf-8")
	} catch {
		// File doesn't exist, start with empty content
	}

	const sortedEdits = edits.sort((a, b) => {
		const lineDiff = b.range.start.line - a.range.start.line
		if (lineDiff !== 0) return lineDiff
		return b.range.start.character - a.range.start.character
	})

	const lines = content.split("\n")
	for (const textEdit of sortedEdits) {
		const startLine = textEdit.range.start.line
		const startChar = textEdit.range.start.character
		const endLine = textEdit.range.end.line
		const endChar = textEdit.range.end.character

		if (startLine === endLine) {
			const line = lines[startLine] || ""
			lines[startLine] = line.substring(0, startChar) + textEdit.newText + line.substring(endChar)
		} else {
			const firstLine = lines[startLine] || ""
			const lastLine = lines[endLine] || ""
			const newContent = firstLine.substring(0, startChar) + textEdit.newText + lastLine.substring(endChar)
			lines.splice(startLine, endLine - startLine + 1, newContent)
		}
	}

	const newContent = lines.join("\n")
	fs.writeFileSync(filePath, newContent, "utf-8")
	return newContent
}

export function updateDocumentAfterEdit(document: TextDocument, newContent: string): void {
	const newLines = newContent.split("\n")

	document.lineCount = newLines.length
	document.getText = (range?: Range) => {
		if (!range) return newContent
		return newLines.slice(range.start.line, range.end.line + 1).join("\n")
	}
	document.lineAt = (line: number): TextLine => {
		const text = newLines[line] || ""
		return {
			text,
			range: new Range(new Position(line, 0), new Position(line, text.length)),
			rangeIncludingLineBreak: new Range(new Position(line, 0), new Position(line + 1, 0)),
			firstNonWhitespaceCharacterIndex: text.search(/\S/),
			isEmptyOrWhitespace: text.trim().length === 0,
		}
	}
	document.offsetAt = (position: Position) => {
		let offset = 0
		for (let i = 0; i < position.line && i < newLines.length; i++) {
			offset += (newLines[i]?.length || 0) + 1
		}
		offset += position.character
		return offset
	}
	document.positionAt = (offset: number) => {
		let currentOffset = 0
		for (let i = 0; i < newLines.length; i++) {
			const lineLength = (newLines[i]?.length || 0) + 1
			if (currentOffset + lineLength > offset) {
				return new Position(i, offset - currentOffset)
			}
			currentOffset += lineLength
		}
		return new Position(newLines.length - 1, newLines[newLines.length - 1]?.length || 0)
	}
}
