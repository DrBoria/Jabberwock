import path from "path"

import type { ToolUse } from "@shared/tools"
import { getDiffViewProvider, getVirtualWorkspace } from "@features/foundation/time-machine"
import type { ITaskModel } from "@features/chat/task"
import { createTool, ToolCallbacks } from "@features/chat/tools/tool"
import { handleApplyDiffPartial } from "@features/chat/tools/engine/edit/index"

import type { ApplyDiffParams } from "./types"
import { validateInputs, checkAccess } from "./validators"
import { handleDiffFailure, applyDiffWithApproval } from "./execution"

export const applyDiffTool = createTool<"apply_diff">({
	name: "apply_diff" as const,

	async execute(params: ApplyDiffParams, task: ITaskModel, callbacks: ToolCallbacks): Promise<void> {
		const { askApproval, handleError, pushToolResult } = callbacks
		const { path: relPathParam, diff: diffContent } = params

		try {
			const validated = await validateInputs(relPathParam, diffContent, task, pushToolResult)

			if (!validated) {
				return
			}

			const { relPath, diffContent: canonicalDiff } = validated
			const absolutePath = path.resolve(task.cwd, relPath)

			const hasError = await checkAccess(relPath, absolutePath, task, pushToolResult)

			if (hasError) {
				return
			}

			const originalContent: string = await getVirtualWorkspace().readFile(absolutePath, "utf-8")

			const diffResult = (await task.diffStrategy?.applyDiff(
				originalContent,
				canonicalDiff,
				parseInt(params.diff.match(/:start_line:(\d+)/)?.[1] ?? ""),
			)) ?? {
				success: false,
				error: "No diff strategy available",
			}

			if (!diffResult.success) {
				await handleDiffFailure(diffResult, absolutePath, relPath, task, pushToolResult)
				return
			}

			await applyDiffWithApproval(
				diffResult,
				canonicalDiff,
				relPath,
				absolutePath,
				originalContent,
				task,
				askApproval,
				pushToolResult,
				() => this.resetPartialState(),
			)
		} catch (error) {
			await handleError("applying diff", error as Error)
			await getDiffViewProvider()!.reset()
			this.resetPartialState()
		}
	},

	async handlePartial(task: ITaskModel, block: ToolUse<"apply_diff">): Promise<void> {
		await handleApplyDiffPartial(task, block, (p) => this.hasPathStabilized(p))
	},
})
