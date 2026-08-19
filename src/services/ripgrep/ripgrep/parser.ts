import * as path from "path"

import { validateAccess } from "@utils/ignore"
import { truncateLine } from "./utils"

interface SearchFileResult {
	file: string
	searchResults: SearchResult[]
}

interface SearchResult {
	lines: SearchLineResult[]
}

interface SearchLineResult {
	line: number
	text: string
	isMatch: boolean
	column?: number
}

interface RipgrepParsedLine {
	type: string
	data: {
		path?: { text: { toString(): string } }
		line_number: number
		lines: { text: string }
		absolute_offset?: number
	}
}

const MAX_RESULTS = 300

function processMatchContextLine(parsed: RipgrepParsedLine, currentFile: SearchFileResult): void {
	const searchLine: SearchLineResult = {
		line: parsed.data.line_number,
		text: truncateLine(parsed.data.lines.text),
		isMatch: parsed.type === "match",
		...(parsed.type === "match" && { column: parsed.data.absolute_offset }),
	}

	const lastResult = currentFile.searchResults[currentFile.searchResults.length - 1]

	if (!lastResult) {
		currentFile.searchResults.push({ lines: [searchLine] })
		return
	}

	const isConsecutive = parsed.data.line_number <= lastResult.lines[lastResult.lines.length - 1].line + 1
	if (lastResult.lines.length > 0 && isConsecutive) {
		lastResult.lines.push(searchLine)
		return
	}

	currentFile.searchResults.push({ lines: [searchLine] })
}

function processRipgrepLine(
	line: string,
	results: SearchFileResult[],
	currentFile: SearchFileResult | null,
): SearchFileResult | null {
	if (!line) {
		return currentFile
	}
	try {
		const parsed: RipgrepParsedLine = JSON.parse(line)
		if (parsed.type === "begin") {
			return {
				file: parsed.data.path!.text.toString(),
				searchResults: [],
			}
		}
		if (parsed.type === "end") {
			results.push(currentFile as SearchFileResult)
			return null
		}
		const isMatchOrContext = parsed.type === "match" || parsed.type === "context"
		if (isMatchOrContext && currentFile) {
			processMatchContextLine(parsed, currentFile)
		}
	} catch (error) {
		console.error("[jabberwock] Error parsing ripgrep output:", error)
	}
	return currentFile
}

function formatResults(fileResults: SearchFileResult[], cwd: string): string {
	const groupedResults: { [key: string]: SearchResult[] } = {}

	const totalResults = fileResults.reduce((sum, file) => sum + file.searchResults.length, 0)
	let output = ""
	if (totalResults >= MAX_RESULTS) {
		output += `Showing first ${MAX_RESULTS} of ${MAX_RESULTS}+ results. Use a more specific search if necessary.\n\n`
	} else {
		output += `Found ${totalResults === 1 ? "1 result" : `${totalResults.toLocaleString()} results`}.\n\n`
	}

	fileResults.slice(0, MAX_RESULTS).forEach((file) => {
		const relativeFilePath = path.relative(cwd, file.file)
		if (!groupedResults[relativeFilePath]) {
			groupedResults[relativeFilePath] = []

			groupedResults[relativeFilePath].push(...file.searchResults)
		}
	})

	for (const [filePath, fileResults] of Object.entries(groupedResults)) {
		output += `# ${filePath.toPosix()}\n`

		fileResults.forEach((result) => {
			if (result.lines.length > 0) {
				result.lines.forEach((line) => {
					const lineNumber = String(line.line).padStart(3, " ")
					output += `${lineNumber} | ${line.text.trimEnd()}\n`
				})
				output += "----\n"
			}
		})

		output += "\n"
	}

	return output.trim()
}

export function parseAndFormatResults(output: string, ignorePatterns: string | undefined, cwd: string): string {
	const results: SearchFileResult[] = []
	let currentFile: SearchFileResult | null = null

	output.split("\n").forEach((line) => {
		currentFile = processRipgrepLine(line, results, currentFile)
	})

	const filteredResults = results.filter((result) => validateAccess(ignorePatterns, result.file, cwd))

	return formatResults(filteredResults, cwd)
}
