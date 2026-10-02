import type { ITaskModel } from "@features/chat/task"
import { DEFAULT_MAX_IMAGE_FILE_SIZE_MB, DEFAULT_MAX_TOTAL_IMAGE_SIZE_MB, ImageMemoryTracker } from "@features/chat"
import type { PushToolResult } from "@shared/tools"

import type { FileResult } from "./helpers.ts"
import { validateAccessAndFilter } from "./helpers.ts"
import { requestApproval } from "./approval.ts"
import { processApprovedFile, buildAndPushResult } from "./processing.ts"
import { getErrorMessage } from "./helpers.ts"
import { emitBroadcast } from "@features/chat/task/messages/actions/say"

export async function processNewFileResults(
	task: ITaskModel,
	fileResults: FileResult[],
	updateFileResult: (path: string, updates: Partial<FileResult>) => void,
	pushToolResult: PushToolResult,
): Promise<void> {
	const filesToApprove = await validateAccessAndFilter(task, fileResults, updateFileResult)
	await requestApproval(task, filesToApprove, updateFileResult)

	const imageMemoryTracker = ImageMemoryTracker()

	for (const fileResult of fileResults) {
		if (fileResult.status !== "approved") continue

		await processApprovedFile(
			task,
			fileResult,
			updateFileResult,
			imageMemoryTracker,
			DEFAULT_MAX_IMAGE_FILE_SIZE_MB as number,
			DEFAULT_MAX_TOTAL_IMAGE_SIZE_MB,
		)
	}

	const hasErrors = fileResults.some((r) => r.status === "error") || fileResults.some((r) => r.status === "blocked")
	if (hasErrors) {
		task._state.setDidToolFailInCurrentTurn(true)
	}

	buildAndPushResult(task, fileResults, pushToolResult)
}

export async function handleNewFileError(
	error: unknown,
	filePath: string,
	fileResults: FileResult[],
	updateFileResult: (path: string, updates: Partial<FileResult>) => void,
	pushToolResult: PushToolResult,
	task: ITaskModel,
): Promise<void> {
	const relPath = filePath || "unknown"
	const errorMsg = getErrorMessage(error)

	updateFileResult(relPath, {
		status: "error",
		error: `Error reading file: ${errorMsg}`,
		nativeContent: `File: ${relPath}\nError: ${errorMsg}`,
	})

	await emitBroadcast("system", task.taskId, "error", `Error reading file ${relPath}: ${errorMsg}`)
	task._state.setDidToolFailInCurrentTurn(true)

	const errorResult = fileResults
		.filter((r) => r.nativeContent)
		.map((r) => r.nativeContent)
		.join("\n\n---\n\n")

	pushToolResult(errorResult || `Error: ${errorMsg}`)
}
