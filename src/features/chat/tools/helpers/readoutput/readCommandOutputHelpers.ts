import * as fs from "fs/promises"
import * as path from "path"

import { getTaskDirectoryPath } from "@utils/io"

import type { ITaskModel } from "@features/chat/task/store"
import { systemBroadcast } from "@features/chat/task/messages/actions/say"
import { sayAndCreateMissingParamError } from "@features/chat/task/messages/actions/command/sayAndCreateMissingParamError"
import { escapeRegExp, formatBytes } from "@features/chat/tools/helpers/shared"

export const DEFAULT_LIMIT = 40 * 1024

export interface SearchResult {
	content: string
	matchCount: number
}

export interface ReadCommandOutputInfo {
	artifactPath: string
	totalSize: number
}

/**
 * Validates that an artifact ID matches the expected format (cmd-{timestamp}.txt)
 */
export function isValidArtifactId(artifactId: string): boolean {
	const isValid = /^cmd-\d+\.txt$/.test(artifactId)
	return isValid
}

/**
 * Adds line numbers to content
 */
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

/**
 * Counts newlines before a given byte offset in a string
 */
export function countNewlinesBeforeOffset(content: string, offset: number): number {
	let count = 0
	const maxIndex = Math.min(offset, content.length)

	for (let i = 0; i < maxIndex; i++) {
		if (content[i] === "\n") {
			count++
		}
	}

	return count
}

/**
 * Reads a portion of an artifact file
 */
export async function readArtifact(
	artifactPath: string,
	offset: number,
	limit: number,
	totalSize: number,
): Promise<string> {
	const readLength = Math.min(limit, totalSize - offset)
	const buffer = Buffer.alloc(readLength)
	const fileHandle = await fs.open(artifactPath, "r")

	try {
		const result = await fileHandle.read(buffer, 0, readLength, offset)
		const content = buffer.slice(0, result.bytesRead).toString("utf8")
		const header = `[Command Output: ${path.basename(artifactPath)}] (read offset ${offset}, limit ${limit}, total ${totalSize})`
		return `${header}\n\n${content}`
	} finally {
		await fileHandle.close()
	}
}

/**
 * Validates read command output parameters and returns artifact info
 */
export async function validateReadCommandOutputParams(
	task: ITaskModel,
	artifactId: string,
	pushToolResult: (result: string) => void,
): Promise<ReadCommandOutputInfo | null> {
	if (!isValidArtifactId(artifactId)) {
		const errorMsg = `Invalid artifact ID format: "${artifactId}". Expected format: cmd-{timestamp}.txt`
		await systemBroadcast(task.taskId, "error", errorMsg)
		pushToolResult(`Error: ${errorMsg}`)
		return null
	}

	const taskDir = await getTaskDirectoryPath(task.globalStoragePath, task.taskId)
	const artifactPath = path.join(taskDir, artifactId)

	try {
		const stats = await fs.stat(artifactPath)
		return { artifactPath, totalSize: stats.size }
	} catch {
		const errorMsg = `Artifact file not found: "${artifactId}". The artifact may have been cleaned up or never existed.`
		await systemBroadcast(task.taskId, "error", errorMsg)
		pushToolResult(`Error: ${errorMsg}`)
		return null
	}
}
