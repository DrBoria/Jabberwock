import type { Task } from "../Task"
import type { ApiMessage } from "../../../../core/task-persistence"
import { saveApiMessages } from "../../../../core/task-persistence"
import { getTaskDirectoryPath } from "../../../../utils/storage"
import { postStateToWebview } from "../../../foundation/window-manager/store"

/**
 * Overwrites the API conversation history for a task and optionally syncs to UI.
 */
export async function overwriteApiConversationHistory(
	task: Task,
	newHistory: ApiMessage[],
	syncToUi: boolean = true,
): Promise<void> {
	task.apiConversationHistory = newHistory
	if (syncToUi) {
		const provider = task.providerRef?.deref()
		if (provider) {
			await postStateToWebview(provider)
		}
	}
}
