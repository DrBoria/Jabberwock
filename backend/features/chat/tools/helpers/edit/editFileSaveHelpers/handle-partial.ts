import path from "path"
import { type SayToolData } from "@jabberwock/types"
import type { ITaskModel } from "@features/chat/task/store"
import { getReadablePath } from "@utils/io/path"
import { isPathOutsideWorkspace } from "@utils/io"
import { ask } from "@features/chat/task/notifications/actions/ask"

export async function handleEditFilePartial(
	task: ITaskModel,
	filePath: string | undefined,
	oldString: string | undefined,
	partial: boolean,
	hasPathStabilized: (path: string | undefined) => boolean,
	setPartialState: (relPath: string) => void,
): Promise<void> {
	if (!hasPathStabilized(filePath)) {
		return
	}

	let operationPreview: string | undefined
	if (oldString !== undefined) {
		if (oldString === "") {
			operationPreview = "creating new file"
		} else {
			const preview = oldString.length > 50 ? oldString.substring(0, 50) + "..." : oldString
			operationPreview = `replacing: "${preview}"`
		}
	}

	let relPath = filePath!
	if (path.isAbsolute(relPath)) {
		relPath = path.relative(task.cwd, relPath)
	}
	setPartialState(relPath)

	const absolutePath = path.resolve(task.cwd, relPath)
	const isOutsideWorkspace = isPathOutsideWorkspace(absolutePath)

	const sharedMessageProps: SayToolData = {
		tool: "appliedDiff",
		path: getReadablePath(task.cwd, relPath),
		diff: operationPreview,
		isOutsideWorkspace,
	}

	await ask(task.taskId, "tool", JSON.stringify(sharedMessageProps), partial).catch(() => {})
}
