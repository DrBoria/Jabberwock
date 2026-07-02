import NodeCache from "node-cache"
import getFolderSize from "get-folder-size"

import type { Goal, Notification, HistoryItem } from "@jabberwock/types"

import { getTaskDirectoryPath } from "@utils/io"
import { combineApiRequests } from "@shared/api/combineApiRequests"
import { consolidateCommands as combineCommandSequences } from "@jabberwock/core/browser"
import { getApiMetrics } from "@shared/api/getApiMetrics"
import { findLastIndex } from "@shared/array"
import { t } from "@i18n"

// ── Task metadata and history ───────────────────────────────────────────────

const taskSizeCache = new NodeCache({ stdTTL: 30, checkperiod: 5 * 60 })

export type TaskMetadataOptions = {
	taskId: string
	rootTaskId?: string
	parentTaskId?: string
	taskNumber: number
	messages: Notification[]
	globalStoragePath: string
	workspace: string
	mode?: string
	apiConfigName?: string
	initialStatus?: "active" | "delegated" | "completed"
	goals?: Goal[]
	goalsHistory?: Goal[]
}

function zeroTokenUsage(): ReturnType<typeof getApiMetrics> {
	return {
		totalTokensIn: 0,
		totalTokensOut: 0,
		totalCacheWrites: 0,
		totalCacheReads: 0,
		totalCost: 0,
		contextTokens: 0,
	}
}

function findTaskTitleMessage(messages: Notification[]): Notification {
	return messages.find((m) => m.say !== "api_req_started" && m.say !== "api_req_finished") || messages[0]
}

function isResumeTask(m: Notification): boolean {
	return m.ask === "resume_task" || m.ask === "resume_completed_task"
}

function findLastRelevantMessage(messages: Notification[], fallback: Notification): Notification {
	const idx = findLastIndex(messages, (m) => !isResumeTask(m))
	return idx !== -1 ? messages[idx] : fallback
}

async function computeTaskDirSize(taskDir: string): Promise<number> {
	const cachedSize = taskSizeCache.get<number>(taskDir)

	if (cachedSize !== undefined) {
		return cachedSize
	}

	try {
		const size = await getFolderSize.loose(taskDir)
		taskSizeCache.set<number>(taskDir, size)
		return size
	} catch {
		return 0
	}
}

function goalText(goals?: Goal[]): string | undefined {
	return goals?.[0]?.text?.trim()
}

function buildTaskSummary(
	goal: string | undefined,
	hasMessages: boolean,
	taskMessage: Notification | undefined,
	taskNumber: number,
): string {
	if (goal) {
		return goal
	}

	if (!hasMessages) {
		return t("common:tasks.no_messages", { taskNumber })
	}

	return taskMessage!.text?.trim() || t("common:tasks.incomplete", { taskNumber })
}

function buildApiConfigOption(apiConfigName?: string): Record<string, string> {
	if (typeof apiConfigName === "string" && apiConfigName.length > 0) {
		return { apiConfigName }
	}

	return {}
}

function buildStatusOption(initialStatus?: string): Record<string, string> {
	if (initialStatus) {
		return { status: initialStatus }
	}

	return {}
}

function buildGoalsOption(goals?: Goal[]): Record<string, Goal[]> {
	if (goals && goals.length > 0) {
		return { goals }
	}

	return {}
}

function buildGoalsHistoryOption(goalsHistory?: Goal[]): Record<string, Goal[]> {
	if (goalsHistory && goalsHistory.length > 0) {
		return { goalsHistory }
	}

	return {}
}

export async function taskMetadata({
	taskId: id,
	rootTaskId,
	parentTaskId,
	taskNumber,
	messages,
	globalStoragePath,
	workspace,
	mode,
	apiConfigName,
	initialStatus,
	goals,
	goalsHistory,
}: TaskMetadataOptions) {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, id)
	const hasMessages = messages.length > 0

	let timestamp: number
	let tokenUsage: ReturnType<typeof getApiMetrics>
	let taskDirSize: number
	let taskMessage: Notification | undefined

	if (!hasMessages) {
		timestamp = Date.now()
		tokenUsage = zeroTokenUsage()
		taskDirSize = 0
	} else {
		taskMessage = findTaskTitleMessage(messages)
		const lastRelevantMessage = findLastRelevantMessage(messages, taskMessage)
		timestamp = lastRelevantMessage.ts
		tokenUsage = getApiMetrics(combineApiRequests(combineCommandSequences(messages.slice(1))))
		taskDirSize = await computeTaskDirSize(taskDir)
	}

	const historyItem: HistoryItem = {
		id,
		rootTaskId,
		parentTaskId,
		number: taskNumber,
		ts: timestamp,
		task: buildTaskSummary(goalText(goals), hasMessages, taskMessage, taskNumber),
		tokensIn: tokenUsage.totalTokensIn,
		tokensOut: tokenUsage.totalTokensOut,
		cacheWrites: tokenUsage.totalCacheWrites,
		cacheReads: tokenUsage.totalCacheReads,
		totalCost: tokenUsage.totalCost,
		size: taskDirSize,
		workspace,
		mode,
		...buildApiConfigOption(apiConfigName),
		...buildStatusOption(initialStatus),
		...buildGoalsOption(goals),
		...buildGoalsHistoryOption(goalsHistory),
	}

	return { historyItem, tokenUsage }
}
