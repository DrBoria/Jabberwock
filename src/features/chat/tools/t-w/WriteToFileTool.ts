import path from "path"

import type { ITaskModel } from "@features/chat/task/store"
import type { ToolUse } from "@shared/tools"
import { EXPERIMENT_IDS, experiments } from "@shared/experiments"

import { BaseTool, ToolCallbacks } from "@features/chat/tools/a-b/BaseTool"
import {
	validateWriteToFilePreConditions,
	prepareWriteToFileExistence,
	processWriteToFileContent,
	buildWriteToFileSharedProps,
	executeWriteToFileFocusDisruption,
	executeWriteToFileNormal,
	finalizeWriteToFile,
	resetWriteToFileState,
	prepareWriteToFilePartialContext,
	updateWriteToFileDiffView,
} from "@features/chat/tools/helpers/write"

interface WriteToFileParams {
	path: string
	content: string
}

export class WriteToFileTool extends BaseTool<"write_to_file"> {
	readonly name = "write_to_file" as const

	async execute(params: WriteToFileParams, task: ITaskModel, callbacks: ToolCallbacks): Promise<void> {
		const { pushToolResult, handleError, askApproval } = callbacks
		const { path: relPath, content: newContent } = params

		const preConditions = await validateWriteToFilePreConditions(relPath, newContent, task, pushToolResult)
		if (!preConditions) {
			return
		}

		const { isFileWriteProtected } = preConditions
		const absolutePath = path.resolve(task.cwd, preConditions.relPath)
		const fileExists = await prepareWriteToFileExistence(preConditions.relPath, absolutePath)
		const processedContent = processWriteToFileContent(preConditions.newContent, task)
		const sharedMessageProps = buildWriteToFileSharedProps(
			preConditions.relPath,
			fileExists,
			processedContent,
			task,
			isFileWriteProtected,
		)

		try {
			task._state.setConsecutiveMistakeCount(0)

			const isPreventFocusDisruptionEnabled = experiments.isEnabled({}, EXPERIMENT_IDS.PREVENT_FOCUS_DISRUPTION)

			const approved = isPreventFocusDisruptionEnabled
				? await executeWriteToFileFocusDisruption(
						fileExists,
						preConditions.relPath,
						processedContent,
						sharedMessageProps,
						askApproval,
						isFileWriteProtected,
						task,
					)
				: await executeWriteToFileNormal(
						fileExists,
						preConditions.relPath,
						processedContent,
						sharedMessageProps,
						askApproval,
						task,
						isFileWriteProtected,
					)

			if (!approved) {
				return
			}

			await finalizeWriteToFile(preConditions.relPath, task, pushToolResult, !fileExists)
			resetWriteToFileState(() => this.resetPartialState())
		} catch (error) {
			await handleError("writing file", error as Error)
			resetWriteToFileState(() => this.resetPartialState())
		}
	}

	override async handlePartial(task: ITaskModel, block: ToolUse<"write_to_file">): Promise<void> {
		const relPath: string | undefined = block.params.path
		const newContent: string | undefined = block.params.content

		if (!this.hasPathStabilized(relPath) || newContent === undefined) {
			return
		}

		const isPreventFocusDisruptionEnabled = experiments.isEnabled({}, EXPERIMENT_IDS.PREVENT_FOCUS_DISRUPTION)

		if (isPreventFocusDisruptionEnabled) {
			return
		}

		const context = await prepareWriteToFilePartialContext(relPath, task)
		if (!context) {
			return
		}

		const { fileExists, isFileWriteProtected } = context

		const sharedMessageProps = buildWriteToFileSharedProps(
			relPath!,
			fileExists,
			newContent || "",
			task,
			isFileWriteProtected,
		)

		await updateWriteToFileDiffView(relPath!, newContent, sharedMessageProps, task, block.partial)
	}
}

export const writeToFileTool = new WriteToFileTool()
