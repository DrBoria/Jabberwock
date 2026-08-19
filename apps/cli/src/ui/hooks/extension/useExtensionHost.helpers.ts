import pWaitFor from "p-wait-for"

import type { ExtensionMessage, HistoryItem } from "@jabberwock/types"
import type { ExtensionHostInterface } from "@/agent/index.js"
import { arePathsEqual } from "@/lib/utils/path.js"

export const TASK_HISTORY_WAIT_TIMEOUT_MS = 2_000

export function extractTaskHistory(message: ExtensionMessage): HistoryItem[] | undefined {
	if (message.type === "state" && Array.isArray(message.state?.taskHistory)) {
		return message.state.taskHistory as HistoryItem[]
	}
	if (message.type === "taskHistoryUpdated" && Array.isArray(message.taskHistory)) {
		return message.taskHistory as HistoryItem[]
	}
	return undefined
}

export function getMostRecentTaskId(taskHistory: HistoryItem[], workspacePath: string): string | undefined {
	const workspaceTasks = taskHistory.filter(
		(item) => typeof item.workspace === "string" && arePathsEqual(item.workspace, workspacePath),
	)
	if (workspaceTasks.length === 0) {
		return undefined
	}
	return [...workspaceTasks].sort((a, b) => b.ts - a.ts)[0]?.id
}

export function formatError(err: unknown): string {
	return err instanceof Error ? err.message : String(err)
}

export function getOptionalString(value: string | undefined): string | undefined {
	return value ? value.trim() : undefined
}

export async function waitForTaskHistory(hasReceivedTaskHistory: () => boolean): Promise<void> {
	await pWaitFor(hasReceivedTaskHistory, { interval: 25, timeout: TASK_HISTORY_WAIT_TIMEOUT_MS }).catch(
		() => undefined,
	)
}

export async function handleSessionResume(
	requestedSessionId: string | undefined,
	continueSession: boolean | undefined,
	taskHistorySnapshot: HistoryItem[],
	workspacePath: string,
	host: ExtensionHostInterface,
	setCurrentTaskId: (id: string) => void,
	setIsResumingTask: (value: boolean) => void,
	setHasStartedTask: (value: boolean) => void,
	setLoading: (value: boolean) => void,
): Promise<boolean> {
	if (!requestedSessionId && !continueSession) {
		return false
	}
	if (requestedSessionId && !taskHistorySnapshot.some((item) => item.id === requestedSessionId)) {
		throw new Error(`Session not found in task history: ${requestedSessionId}`)
	}
	const resolvedSessionId = requestedSessionId || getMostRecentTaskId(taskHistorySnapshot, workspacePath)
	if (continueSession && !resolvedSessionId) {
		throw new Error("No previous tasks found to continue in this workspace.")
	}
	if (resolvedSessionId) {
		setCurrentTaskId(resolvedSessionId)
		setIsResumingTask(true)
		setHasStartedTask(true)
		setLoading(true)
		host.sendToExtension({ type: "showTaskWithId", text: resolvedSessionId })
		return true
	}
	return false
}
