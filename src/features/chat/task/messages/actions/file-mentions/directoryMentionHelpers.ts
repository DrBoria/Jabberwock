import fs from "fs/promises"
import * as path from "path"
import { Dirent } from "fs"

import { isBinaryFile } from "isbinaryfile"

import { extractTextFromFileWithMetadata } from "@integrations/misc/extract-text"
import type { ExtractTextResult } from "@integrations/misc/extract-text"
import { DEFAULT_LINE_LIMIT } from "@features/settings/context/tools/native-tools/r/read_file"
import { validateAccess } from "@utils/ignore"

import type { ContentBlockShape } from "@features/chat/task/messages/actions/types"

export function formatFileReadResult(filePath: string, result: ExtractTextResult): string {
	const header = `[read_file for '${filePath}']`

	if (result.wasTruncated && result.linesShown) {
		const [start, end] = result.linesShown
		const nextOffset = end + 1
		return `${header}
IMPORTANT: File content truncated.
Status: Showing lines ${start}-${end} of ${result.totalLines} total lines.
To read more: Use the read_file tool with offset=${nextOffset} and limit=${DEFAULT_LINE_LIMIT}.

File: ${filePath}
${result.content}`
	}

	return `${header}
File: ${filePath}
${result.content}`
}

export async function readAndFormatFile(
	absPath: string,
	entryName: string,
	mentionPath: string,
): Promise<string | null> {
	const absoluteFilePath = path.resolve(absPath, entryName)
	try {
		const isBinary = await isBinaryFile(absoluteFilePath).catch(() => false)
		if (isBinary) {
			return null
		}
		const result = await extractTextFromFileWithMetadata(absoluteFilePath)
		const filePath = path.join(mentionPath, entryName)
		return formatFileReadResult(filePath.toPosix(), result)
	} catch (_error) {
		return null
	}
}

export async function processDirectoryEntry(
	entry: Dirent,
	index: number,
	total: number,
	absPath: string,
	mentionPath: string,
	cwd: string,
	jabberwockIgnoreController?: string,
	showJabberwockIgnoredFiles: boolean = false,
): Promise<{ line: string; fileResult: string | null }> {
	const isLast = index === total - 1
	const linePrefix = isLast ? "└── " : "├── "
	const entryPath = path.join(absPath, entry.name)

	const isIgnored = !validateAccess(jabberwockIgnoreController, entryPath, cwd)

	if (isIgnored && !showJabberwockIgnoredFiles) {
		return { line: "", fileResult: null }
	}

	const displayName = isIgnored ? `🔒 ${entry.name}` : entry.name

	if (entry.isFile()) {
		const line = `${linePrefix}${displayName}\n`
		let fileResult: string | null = null
		if (!isIgnored) {
			fileResult = await readAndFormatFile(absPath, entry.name, mentionPath)
		}
		return { line, fileResult }
	}

	if (entry.isDirectory()) {
		return { line: `${linePrefix}${displayName}/\n`, fileResult: null }
	}

	return { line: `${linePrefix}${displayName}\n`, fileResult: null }
}

export async function handleDirectoryMention(
	absPath: string,
	mentionPath: string,
	cwd: string,
	jabberwockIgnoreController?: string,
	showJabberwockIgnoredFiles: boolean = false,
): Promise<ContentBlockShape> {
	const entries = await fs.readdir(absPath, { withFileTypes: true })
	let folderListing = ""
	const fileReadResults: string[] = []

	for (let index = 0; index < entries.length; index++) {
		const entry = entries[index]
		const entryResult = await processDirectoryEntry(
			entry,
			index,
			entries.length,
			absPath,
			mentionPath,
			cwd,
			jabberwockIgnoreController,
			showJabberwockIgnoredFiles,
		)

		if (entryResult.line) {
			folderListing += entryResult.line
		}
		if (entryResult.fileResult) {
			fileReadResults.push(entryResult.fileResult)
		}
	}

	let content = `[read_file for folder '${mentionPath}']\nFolder listing:\n${folderListing}`
	if (fileReadResults.length > 0) {
		content += `\n\n--- File Contents ---\n\n${fileReadResults.join("\n\n")}`
	}

	return {
		type: "folder",
		path: mentionPath,
		content,
	}
}
