import * as fs from "fs/promises"
import * as path from "path"

import { getTaskDirectoryPath } from "@utils/io"

import type { ITaskModel } from "@features/chat/task"
import { emitBroadcast } from "@features/chat/task/messages/actions/say"

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
		await emitBroadcast("system", task.taskId, "error", errorMsg)
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
		await emitBroadcast("system", task.taskId, "error", errorMsg)
		pushToolResult(`Error: ${errorMsg}`)
		return null
	}
}
