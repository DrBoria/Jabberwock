import type { HistoryItem } from "@jabberwock/types"
import { getHistoryState } from "@features/hist/actions"
import { getWorkspaceTracker } from "@features/foundation/window-manager/store"

export async function sendTaskHistory(
	provider: { postMessageToWebview: (msg: unknown) => Promise<void> },
	rootStore: never,
): Promise<void> {
	try {
		const historyState = getHistoryState(rootStore)

		if (historyState?.items?.length) {
			provider.postMessageToWebview({ type: "taskHistoryUpdated", taskHistory: historyState.items })
		}
	} catch (error: unknown) {
		console.error(
			`[jabberwock] [${new Date().toISOString()}] webviewDidLaunch: failed to send task history:`,
			error,
		)
	}
}

export async function restoreChatState(
	provider: { postMessageToWebview: (msg: unknown) => Promise<void> },
	rootStore: never,
): Promise<void> {
	try {
		const activeTask = getStoreActiveTask(rootStore)

		if (activeTask) {
			const uiMessages = activeTask.messages ?? []

			if (uiMessages.length > 0) {
				const currentTaskItem: Partial<HistoryItem> = {
					id: activeTask.taskId,
					ts: uiMessages[0]?.ts ?? Date.now(),
					task: activeTask.taskId,
					mode: activeTask._taskMode ?? undefined,
				}
				await provider.postMessageToWebview({
					type: "state",
					state: { messages: uiMessages, currentTaskItem },
				})
			}
		}
	} catch (error: unknown) {
		console.error(
			`[jabberwock] [${new Date().toISOString()}] webviewDidLaunch: failed to restore chat state:`,
			error,
		)
	}
}

function getStoreActiveTask(
	rootStore: never,
): { taskId: string; messages?: { ts: number }[]; _taskMode?: string } | undefined {
	return (rootStore as never as { chat: { activeTask: never } }).chat.activeTask as never
}

export async function initializeWorkspaceTracker(provider: {
	postMessageToWebview: (msg: unknown) => Promise<void>
}): Promise<void> {
	try {
		const workspaceTracker = await getWorkspaceTracker(provider as never)

		await workspaceTracker?.initializeFilePaths()
	} catch (error: unknown) {
		console.error(
			`[jabberwock] [${new Date().toISOString()}] webviewDidLaunch: failed to initialize workspace tracker:`,
			error,
		)
	}
}
