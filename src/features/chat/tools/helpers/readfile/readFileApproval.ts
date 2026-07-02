import path from "path"

import type { SayToolData } from "@jabberwock/types"

import type { ITaskModel } from "@features/chat/task/store"
import { isPathOutsideWorkspace } from "@utils/io"
import { getReadablePath } from "@utils/io/path"
import { DEFAULT_LINE_LIMIT } from "@features/settings/context/tools/native-tools/r/read_file"

import { ask } from "@features/chat/task/notifications/actions/ask"
import { userBroadcast } from "@features/chat/task/messages/actions/say"

import type { FileResult, InternalFileEntry } from "./readFileHelpers"

// ─── Line Helpers ─────────────────────────────────────────────────────────────────

function getStartLine(entry: InternalFileEntry): number | undefined {
	if (entry.mode === "indentation") {
		return entry.anchor_line ?? entry.offset ?? 1
	}
	const offset = entry.offset ?? 1
	return offset > 1 ? offset : undefined
}

function getLineSnippet(entry: InternalFileEntry): string {
	if (entry.mode === "indentation") {
		const effectiveAnchor = entry.anchor_line ?? entry.offset ?? 1
		return `(indentation mode at line ${effectiveAnchor})`
	}

	const limit = entry.limit ?? DEFAULT_LINE_LIMIT
	const offset1 = entry.offset ?? 1

	if (offset1 > 1) {
		return `(lines ${offset1}-${offset1 + limit - 1})`
	}

	return `(up to ${limit} lines)`
}

// ─── Approval Message ─────────────────────────────────────────────────────────────

function createApprovalMessage(task: ITaskModel, fileResult: FileResult): Record<string, unknown> {
	const relPath = fileResult.path
	const fullPath = path.resolve(task.cwd, relPath)
	const isOutsideWorkspace = isPathOutsideWorkspace(fullPath)
	const lineSnippet = getLineSnippet(fileResult.entry!)
	const startLine = getStartLine(fileResult.entry!)

	return {
		tool: "readFile",
		path: getReadablePath(task.cwd, relPath),
		isOutsideWorkspace,
		content: fullPath,
		reason: lineSnippet,
		startLine,
	}
}

// ─── Single File Approval ─────────────────────────────────────────────────────────

export async function requestSingleFileApproval(
	task: ITaskModel,
	fileResult: FileResult,
	updateFileResult: (path: string, updates: Partial<FileResult>) => void,
): Promise<void> {
	const relPath = fileResult.path
	const message = createApprovalMessage(task, fileResult)
	const completeMessage = JSON.stringify(message)

	const { response, text, images } = await ask(task.taskId, "tool", completeMessage, false)

	if (response !== "yesButtonClicked") {
		if (text) await userBroadcast(task.taskId, "user_feedback", text, images)
		task._state.setDidRejectTool(true)
		updateFileResult(relPath, {
			status: "denied",
			nativeContent: `File: ${relPath}\nStatus: Denied by user`,
			feedbackText: text,
			feedbackImages: images,
		})
	} else {
		if (text) await userBroadcast(task.taskId, "user_feedback", text, images)
		updateFileResult(relPath, { status: "approved", feedbackText: text, feedbackImages: images })
	}
}

// ─── Batch Approval ───────────────────────────────────────────────────────────────

export async function requestBatchApproval(
	task: ITaskModel,
	filesToApprove: FileResult[],
	updateFileResult: (path: string, updates: Partial<FileResult>) => void,
): Promise<void> {
	const batchFiles = filesToApprove.map((fileResult) => {
		const relPath = fileResult.path
		const fullPath = path.resolve(task.cwd, relPath)
		const isOutsideWorkspace = isPathOutsideWorkspace(fullPath)
		const readablePath = getReadablePath(task.cwd, relPath)
		const lineSnippet = getLineSnippet(fileResult.entry!)
		const key = `${readablePath}${lineSnippet ? ` (${lineSnippet})` : ""}`

		return { path: readablePath, lineSnippet, isOutsideWorkspace, key, content: fullPath }
	})

	const completeMessage = JSON.stringify({ tool: "readFile", batchFiles })
	const { response, text, images } = await ask(task.taskId, "tool", completeMessage, false)

	if (response === "yesButtonClicked") {
		if (text) await userBroadcast(task.taskId, "user_feedback", text, images)
		filesToApprove.forEach((fr) => {
			updateFileResult(fr.path, { status: "approved", feedbackText: text, feedbackImages: images })
		})
	} else if (response === "noButtonClicked") {
		if (text) await userBroadcast(task.taskId, "user_feedback", text, images)
		task._state.setDidRejectTool(true)
		filesToApprove.forEach((fr) => {
			updateFileResult(fr.path, {
				status: "denied",
				nativeContent: `File: ${fr.path}\nStatus: Denied by user`,
				feedbackText: text,
				feedbackImages: images,
			})
		})
	} else {
		await handleIndividualBatchPermissions(task, filesToApprove, batchFiles, updateFileResult, text)
	}
}

// ─── Individual Batch Permissions ─────────────────────────────────────────────────

async function handleIndividualBatchPermissions(
	task: ITaskModel,
	filesToApprove: FileResult[],
	batchFiles: { path: string; lineSnippet: string; isOutsideWorkspace: boolean; key: string; content: string }[],
	updateFileResult: (path: string, updates: Partial<FileResult>) => void,
	text: string | undefined,
): Promise<void> {
	try {
		const individualPermissions = JSON.parse(text || "{}")
		let hasAnyDenial = false

		batchFiles.forEach((batchFile, index) => {
			const fileResult = filesToApprove[index]
			const approved = individualPermissions[batchFile.key] === true

			if (approved) {
				updateFileResult(fileResult.path, { status: "approved" })
			} else {
				hasAnyDenial = true
				updateFileResult(fileResult.path, {
					status: "denied",
					nativeContent: `File: ${fileResult.path}\nStatus: Denied by user`,
				})
			}
		})

		if (hasAnyDenial) task._state.setDidRejectTool(true)
	} catch {
		task._state.setDidRejectTool(true)
		filesToApprove.forEach((fr) => {
			updateFileResult(fr.path, {
				status: "denied",
				nativeContent: `File: ${fr.path}\nStatus: Denied by user`,
			})
		})
	}
}

// ─── Top-Level Approval Dispatcher ────────────────────────────────────────────────

export async function requestApproval(
	task: ITaskModel,
	filesToApprove: FileResult[],
	updateFileResult: (path: string, updates: Partial<FileResult>) => void,
): Promise<void> {
	if (filesToApprove.length === 0) return

	if (filesToApprove.length > 1) {
		await requestBatchApproval(task, filesToApprove, updateFileResult)
	} else {
		await requestSingleFileApproval(task, filesToApprove[0], updateFileResult)
	}
}
