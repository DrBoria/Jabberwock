import { vscode } from "@jabberwock/devtool/webview"
import type { WebviewMessage } from "@jabberwock/types"
import { eventConstants } from "@jabberwock/types"

/**
 * Request context condensation for the given task.
 * Dispatches a {@link eventConstants.CHAT.TASK.CONDENSE_TASK_CONTEXT_REQUEST} event
 * to the extension host via the VS Code webview postMessage API.
 *
 * @param taskId - The ID of the task whose context should be condensed.
 */
export function condenseContext(taskId: string): void {
	vscode.postMessage({
		type: eventConstants.CHAT.TASK.CONDENSE_TASK_CONTEXT_REQUEST,
		text: taskId,
	} satisfies WebviewMessage)
}
