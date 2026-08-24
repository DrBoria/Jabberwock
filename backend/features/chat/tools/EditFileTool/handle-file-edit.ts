import type { ITaskModel } from "@features/chat/task/store"
import type { ToolCallbacks } from "@features/chat/tools/a-b/BaseTool"
import type { LineEnding } from "@features/chat/tools/helpers/edit"
import { performEditReplacement, restoreLineEnding } from "@features/chat/tools/helpers/edit/core/editFileHelpers"
import {
	handleEditFileApprovalAndSave,
	handleEditFileReplacementError,
	handleEditFileNoChanges,
} from "@features/chat/tools/helpers/edit/editFileSaveHelpers/index"

export async function handleFileEdit(
	isNewFile: boolean,
	currentContentLF: string | null,
	currentContent: string | null,
	originalEol: LineEnding,
	oldLF: string,
	newLF: string,
	expectedRepl: number,
	absolutePath: string,
	relPath: string,
	task: ITaskModel,
	askApproval: ToolCallbacks["askApproval"],
	pushToolResult: (content: string) => void,
	isFileWriteProtected: boolean,
	newString: string,
	resetPartialState: () => void,
	finalizePartialToolAsk: (relPath: string, task: ITaskModel) => Promise<void>,
): Promise<void> {
	if (isNewFile) {
		await handleEditFileApprovalAndSave(
			relPath,
			absolutePath,
			newString,
			currentContent,
			true,
			task,
			askApproval,
			pushToolResult,
			isFileWriteProtected,
			expectedRepl,
			resetPartialState,
		)
		return
	}

	if (currentContentLF === null) {
		return
	}

	const replacement = performEditReplacement(currentContentLF, oldLF, newLF, expectedRepl, false, absolutePath)

	if (!replacement.success) {
		await handleEditFileReplacementError(replacement.error, relPath, task, pushToolResult, finalizePartialToolAsk)
		return
	}

	const restoredContent = restoreLineEnding(replacement.contentLF, originalEol)

	if (restoredContent === currentContent) {
		await handleEditFileNoChanges(relPath, task, pushToolResult, finalizePartialToolAsk)
		return
	}

	await handleEditFileApprovalAndSave(
		relPath,
		absolutePath,
		restoredContent,
		currentContent,
		false,
		task,
		askApproval,
		pushToolResult,
		isFileWriteProtected,
		expectedRepl,
		resetPartialState,
	)
}
