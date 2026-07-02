import * as fs from "fs/promises"
import * as path from "path"

import { SearchResult } from "./readCommandOutputHelpers"
import { escapeRegExp, formatBytes } from "@features/chat/tools/helpers/shared"

interface ChunkProcessingResult {
	matches: Array<{ lineNumber: number; content: string }>
	lineNumber: number
	totalMatchBytes: number
	hitLimit: boolean
}

function processSearchChunk(
	lines: string[],
	regex: RegExp,
	limit: number,
	startLineNumber: number,
	startMatchBytes: number,
): ChunkProcessingResult {
	const matches: Array<{ lineNumber: number; content: string }> = []
	let lineNumber = startLineNumber
	let totalMatchBytes = startMatchBytes

	for (const line of lines) {
		lineNumber++

		if (regex.test(line)) {
			const lineBytes = Buffer.byteLength(line, "utf8")

			if (totalMatchBytes + lineBytes > limit) {
				return { matches, lineNumber, totalMatchBytes, hitLimit: true }
			}

			matches.push({ lineNumber, content: line })
			totalMatchBytes += lineBytes
		}
	}

	return { matches, lineNumber, totalMatchBytes, hitLimit: false }
}

function processPartialLine(
	partialLine: string,
	regex: RegExp,
	limit: number,
	lineNumber: number,
	totalMatchBytes: number,
): { lineNumber: number; matches: Array<{ lineNumber: number; content: string }> } {
	if (partialLine.length === 0 || !regex.test(partialLine)) {
		return { lineNumber, matches: [] }
	}

	const lineBytes = Buffer.byteLength(partialLine, "utf8")
	if (totalMatchBytes + lineBytes > limit) {
		return { lineNumber, matches: [] }
	}

	return { lineNumber: lineNumber + 1, matches: [{ lineNumber: lineNumber + 1, content: partialLine }] }
}

function formatSearchResults(
	artifactPath: string,
	pattern: string,
	totalSize: number,
	matches: Array<{ lineNumber: number; content: string }>,
): SearchResult {
	const artifactId = path.basename(artifactPath)

	if (matches.length === 0) {
		const content = [
			`[Command Output: ${artifactId}] (search: "${pattern}")`,
			`Total size: ${formatBytes(totalSize)}`,
			"",
			"No matches found for the search pattern.",
		].join("\n")
		return { content, matchCount: 0 }
	}

	const matchedLines = matches.map((m) => `${String(m.lineNumber).padStart(5)} | ${m.content}`).join("\n")

	const content = [
		`[Command Output: ${artifactId}] (search: "${pattern}")`,
		`Total matches: ${matches.length} | Showing first ${matches.length}`,
		"",
		matchedLines,
	].join("\n")
	return { content, matchCount: matches.length }
}

export async function searchInArtifact(
	artifactPath: string,
	pattern: string,
	totalSize: number,
	limit: number,
): Promise<SearchResult> {
	const CHUNK_SIZE = 64 * 1024

	let regex: RegExp
	try {
		regex = new RegExp(pattern, "i")
	} catch {
		regex = new RegExp(escapeRegExp(pattern), "i")
	}

	const fileHandle = await fs.open(artifactPath, "r")
	const matches: Array<{ lineNumber: number; content: string }> = []
	let totalMatchBytes = 0
	let lineNumber = 0
	let partialLine = ""
	let bytesRead = 0
	let hitLimit = false

	try {
		while (bytesRead < totalSize && !hitLimit) {
			const chunkSize = Math.min(CHUNK_SIZE, totalSize - bytesRead)
			const buffer = Buffer.alloc(chunkSize)
			const result = await fileHandle.read(buffer, 0, chunkSize, bytesRead)

			if (result.bytesRead === 0) {
				break
			}

			const chunk = buffer.slice(0, result.bytesRead).toString("utf8")
			bytesRead += result.bytesRead

			const combined = partialLine + chunk
			const lines = combined.split("\n")
			partialLine = lines.pop() ?? ""

			const processed = processSearchChunk(lines, regex, limit, lineNumber, totalMatchBytes)
			matches.push(...processed.matches)
			lineNumber = processed.lineNumber
			totalMatchBytes = processed.totalMatchBytes
			if (processed.hitLimit) {
				hitLimit = true
			}
		}

		const partialResult = processPartialLine(partialLine, regex, limit, lineNumber, totalMatchBytes)
		matches.push(...partialResult.matches)
		lineNumber = partialResult.lineNumber
	} finally {
		await fileHandle.close()
	}

	return formatSearchResults(artifactPath, pattern, totalSize, matches)
}
