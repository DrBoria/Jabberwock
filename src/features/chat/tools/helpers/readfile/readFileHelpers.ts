import type { ReadFileMode, ReadFileParams } from "@jabberwock/types"

import type { ITaskModel } from "@features/chat/task/store"
import { formatResponse } from "@features/settings/context/responses"
import type { PushToolResult } from "@shared/tools"

import { systemBroadcast } from "@features/chat/task/messages/actions/say"

import { validateAccess } from "@utils/ignore"

export interface InternalFileEntry {
	path: string
	mode?: ReadFileMode
	offset?: number
	limit?: number
	anchor_line?: number
	max_levels?: number
	include_siblings?: boolean
	include_header?: boolean
	max_lines?: number
}

export interface FileResult {
	path: string
	status: "approved" | "denied" | "blocked" | "error" | "pending"
	content?: string
	error?: string
	notice?: string
	nativeContent?: string
	imageDataUrl?: string
	feedbackText?: string
	feedbackImages?: string[]
	entry?: InternalFileEntry
}

export function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

export function updateFileResultInList(
	fileResults: FileResult[],
	filePath: string,
	updates: Partial<FileResult>,
): void {
	const index = fileResults.findIndex((result) => result.path === filePath)
	if (index !== -1) {
		fileResults[index] = { ...fileResults[index], ...updates }
	}
}

export function validateOffsetParam(
	offset: number | undefined,
	paramName: string,
	pushToolResult: PushToolResult,
): boolean {
	if (offset !== undefined && offset < 1) {
		const errorMsg = `${paramName} must be a 1-indexed line number (got ${offset}). Line numbers start at 1.`
		pushToolResult(`Error: ${errorMsg}`)
		return false
	}
	return true
}

export async function validateAccessAndFilter(
	task: ITaskModel,
	fileResults: FileResult[],
	updateFileResult: (path: string, updates: Partial<FileResult>) => void,
): Promise<FileResult[]> {
	const filesToApprove: FileResult[] = []

	for (const fileResult of fileResults) {
		const relPath = fileResult.path

		const accessAllowed = validateAccess(task.jabberwockIgnoreController, relPath, task.cwd)
		if (!accessAllowed) {
			await systemBroadcast(task.taskId, "rooignore_error", relPath)
			const errorMsg = formatResponse.jabberwockIgnoreError(relPath)
			updateFileResult(relPath, {
				status: "blocked",
				error: errorMsg,
				nativeContent: `File: ${relPath}\nError: ${errorMsg}`,
			})
			continue
		}

		filesToApprove.push(fileResult)
	}

	return filesToApprove
}

export function buildFileEntry(params: ReadFileParams, filePath: string): InternalFileEntry {
	return {
		path: filePath,
		mode: params.mode,
		offset: params.offset,
		limit: params.limit,
		anchor_line: params.indentation?.anchor_line,
		max_levels: params.indentation?.max_levels,
		include_siblings: params.indentation?.include_siblings,
		include_header: params.indentation?.include_header,
		max_lines: params.indentation?.max_lines,
	}
}
