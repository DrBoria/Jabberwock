/**
 * Frontend Chat Task event action creators.
 *
 * These functions dispatch chat-task-related events to the backend
 * via vscode.postMessage. They live in events/actions/ instead of
 * the store to decouple action dispatch from MST state management.
 */

import { vscode } from "@jabberwock/devtool/webview"
import type { WebviewMessage, Goal } from "@jabberwock/types"
import { FrontendChatTaskEventKeys } from "../constants"

export function sendGoalAdd(text: string) {
	vscode.postMessage({
		type: FrontendChatTaskEventKeys.GOAL_ADD,
		text,
	} satisfies WebviewMessage)
}

export function sendGoalRemove(id: string) {
	vscode.postMessage({
		type: FrontendChatTaskEventKeys.GOAL_REMOVE,
		id,
	} satisfies WebviewMessage)
}

export function sendGoalUpdate(id: string, partial: Partial<Goal>) {
	vscode.postMessage({
		type: FrontendChatTaskEventKeys.GOAL_UPDATE,
		id,
		...(partial.text !== undefined ? { text: partial.text } : {}),
		...(partial.importance !== undefined ? { importance: partial.importance } : {}),
	} satisfies WebviewMessage)
}

export function sendGoalReorder(fromIndex: number, toIndex: number) {
	vscode.postMessage({
		type: FrontendChatTaskEventKeys.GOAL_REORDER,
		fromIndex,
		toIndex,
	} satisfies WebviewMessage)
}

export function sendNavigateToTask(taskId: string) {
	vscode.postMessage({
		type: FrontendChatTaskEventKeys.SHOW_TASK_WITH_ID,
		text: taskId,
	} satisfies WebviewMessage)
}
