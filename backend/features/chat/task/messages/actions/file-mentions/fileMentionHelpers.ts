import fs from "fs/promises"
import * as path from "path"

import { isBinaryFile } from "isbinaryfile"

import { unescapeSpaces } from "@shared/context/mentions"
import { extractTextFromFileWithMetadata } from "@integrations/misc/extract-text"
import { FileContextTracker } from "@features/foundation/time-machine/file-context/FileContextTracker"
import { validateAccess } from "@utils/ignore"

import { formatFileReadResult, handleDirectoryMention } from "./directoryMentionHelpers"
import type { ContentBlockShape } from "@features/chat/task/messages/actions/types"

async function handleFileMention(
	absPath: string,
	mentionPath: string,
	fileContextTracker?: FileContextTracker,
): Promise<ContentBlockShape> {
	const isBinary = await isBinaryFile(absPath).catch(() => false)
	if (isBinary) {
		return {
			type: "file",
			path: mentionPath,
			content: `[read_file for '${mentionPath}']\nNote: Binary file omitted from context.`,
		}
	}

	const result = await extractTextFromFileWithMetadata(absPath)

	if (fileContextTracker) {
		await fileContextTracker.trackFileContext(mentionPath, "file_mentioned")
	}

	return {
		type: "file",
		path: mentionPath,
		content: formatFileReadResult(mentionPath, result),
		metadata: {
			totalLines: result.totalLines,
			returnedLines: result.returnedLines,
			wasTruncated: result.wasTruncated,
			linesShown: result.linesShown,
		},
	}
}

export async function getFileOrFolderContentWithMetadata(
	mentionPath: string,
	cwd: string,
	jabberwockIgnoreController?: string,
	showJabberwockIgnoredFiles: boolean = false,
	fileContextTracker?: FileContextTracker,
): Promise<ContentBlockShape> {
	const unescapedPath = unescapeSpaces(mentionPath)
	const absPath = path.resolve(cwd, unescapedPath)
	const isFolder = mentionPath.endsWith("/")

	try {
		const stats = await fs.stat(absPath)

		if (stats.isFile()) {
			if (!validateAccess(jabberwockIgnoreController, unescapedPath, cwd)) {
				return {
					type: "file",
					path: mentionPath,
					content: `[read_file for '${mentionPath}']\nNote: File is ignored by .jabberwockignore.`,
				}
			}

			try {
				return await handleFileMention(absPath, mentionPath, fileContextTracker)
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error)
				return {
					type: "file",
					path: mentionPath,
					content: `[read_file for '${mentionPath}']\nError: ${errorMsg}`,
				}
			}
		}

		if (stats.isDirectory()) {
			return await handleDirectoryMention(
				absPath,
				mentionPath,
				cwd,
				jabberwockIgnoreController,
				showJabberwockIgnoredFiles,
			)
		}

		return {
			type: isFolder ? "folder" : "file",
			path: mentionPath,
			content: `[read_file for '${mentionPath}']\nError: Unable to read (not a file or directory)`,
		}
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error)
		throw new Error(`Failed to access path "${mentionPath}": ${errorMsg}`)
	}
}

function buildMentionErrorContent(mention: string, mentionPath: string, error: unknown): ContentBlockShape {
	const errorMsg = error instanceof Error ? error.message : String(error)
	return {
		type: mention.endsWith("/") ? "folder" : "file",
		path: mentionPath,
		content: `[read_file for '${mentionPath}']\nError: ${errorMsg}`,
	}
}

export async function processFileMention(
	mention: string,
	cwd: string,
	jabberwockIgnoreController: string | undefined,
	showJabberwockIgnoredFiles: boolean,
	fileContextTracker: FileContextTracker | undefined,
): Promise<ContentBlockShape> {
	const mentionPath = mention.slice(1)
	try {
		return await getFileOrFolderContentWithMetadata(
			mentionPath,
			cwd,
			jabberwockIgnoreController,
			showJabberwockIgnoredFiles,
			fileContextTracker,
		)
	} catch (error) {
		return buildMentionErrorContent(mention, mentionPath, error)
	}
}
