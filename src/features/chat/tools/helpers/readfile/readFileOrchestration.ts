import type { ITaskModel } from "@features/chat/task/store"
import {
	DEFAULT_MAX_IMAGE_FILE_SIZE_MB,
	DEFAULT_MAX_TOTAL_IMAGE_SIZE_MB,
	ImageMemoryTracker,
} from "@features/chat/tools/helpers/generate-image/imageHelpers"
import type { PushToolResult } from "@shared/tools"

import type { FileResult } from "./readFileHelpers"
import { validateAccessAndFilter } from "./readFileHelpers"
import { requestApproval } from "./readFileApproval"
import { processApprovedFile, buildAndPushResult } from "./readFileProcessing"
import { getErrorMessage } from "./readFileHelpers"
import { systemBroadcast } from "@features/chat/task/messages/actions/say"

export async function processNewFileResults(
	task: ITaskModel,
	fileResults: FileResult[],
	updateFileResult: (path: string, updates: Partial<FileResult>) => void,
	pushToolResult: PushToolResult,
): Promise<void> {
	const filesToApprove = await validateAccessAndFilter(task, fileResults, updateFileResult)
	await requestApproval(task, filesToApprove, updateFileResult)

	const imageMemoryTracker = new ImageMemoryTracker()

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

	await systemBroadcast(task.taskId, "error", `Error reading file ${relPath}: ${errorMsg}`)
	task._state.setDidToolFailInCurrentTurn(true)

	const errorResult = fileResults
		.filter((r) => r.nativeContent)
		.map((r) => r.nativeContent)
		.join("\n\n---\n\n")

	pushToolResult(errorResult || `Error: ${errorMsg}`)
}
