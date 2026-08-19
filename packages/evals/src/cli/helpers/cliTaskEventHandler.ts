import { type ToolUsage, type ToolName, JabberwockEventName, IpcMessageType } from "@jabberwock/types"
import type { IpcClient } from "@jabberwock/ipc"

import { updateTaskMetrics, createToolError } from "../../db/index"

import { mergeToolUsage } from "../utils"

import type { TaskEventHandlerOptions } from "./taskEventHandlerTypes"

const IGNORE_EVENTS_FOR_BROADCAST = [JabberwockEventName.Message]

function isApiRetryEvent(eventName: string, payload: unknown[]): boolean {
	return (
		eventName === JabberwockEventName.Message &&
		(payload[0] as { message: { say: string } }).message?.say != null &&
		["api_req_retry_delayed", "api_req_retried"].includes((payload[0] as { message: { say: string } }).message.say)
	)
}

function handleTaskStarted(options: TaskEventHandlerOptions, payload: unknown[]): void {
	const { taskStartedAt } = options
	taskStartedAt.current = Date.now()
	options.jabberwockTaskId.current = payload[0] as string
	options.logger.info(`received TaskStarted event, jabberwockTaskId: ${options.jabberwockTaskId.current}`)
}

async function handleTaskToolFailed(
	options: TaskEventHandlerOptions,
	payload: unknown[],
	taskId: number,
): Promise<void> {
	const [_taskId, toolName, error] = payload
	await createToolError({ taskId, toolName: toolName as ToolName, error: error as string })
}

async function handleMetricsUpdate(
	options: TaskEventHandlerOptions,
	payload: unknown[],
	taskStartedAt: number,
): Promise<void> {
	const { taskMetricsId } = options
	const duration = Date.now() - taskStartedAt

	const { totalCost, totalTokensIn, totalTokensOut, contextTokens, totalCacheWrites, totalCacheReads } =
		payload[1] as {
			totalCost: number
			totalTokensIn: number
			totalTokensOut: number
			contextTokens: number
			totalCacheWrites: number
			totalCacheReads: number
		}

	const incomingToolUsage = (payload[2] ?? {}) as ToolUsage
	mergeToolUsage(options.accumulatedToolUsage, incomingToolUsage)

	await updateTaskMetrics(taskMetricsId, {
		cost: totalCost,
		tokensIn: totalTokensIn,
		tokensOut: totalTokensOut,
		tokensContext: contextTokens,
		duration,
		cacheWrites: totalCacheWrites ?? 0,
		cacheReads: totalCacheReads ?? 0,
		toolUsage: options.accumulatedToolUsage,
	})
}

export function registerCliTaskEventHandler({
	client,
	options,
	taskId,
}: {
	client: IpcClient
	options: TaskEventHandlerOptions
	taskId: number
}): void {
	client.on(IpcMessageType.TaskEvent, async (taskEvent) => {
		const { eventName, payload } = taskEvent

		if (isApiRetryEvent(eventName, payload ?? [])) {
			options.isApiUnstable.current = true
		}

		if (!IGNORE_EVENTS_FOR_BROADCAST.includes(eventName as JabberwockEventName)) {
			await options.publish({ ...taskEvent, taskId })
		}

		if (eventName === JabberwockEventName.TaskStarted) {
			handleTaskStarted(options, payload)
		}

		if (eventName === JabberwockEventName.TaskToolFailed) {
			await handleTaskToolFailed(options, payload, taskId)
		}

		if (
			eventName === JabberwockEventName.TaskTokenUsageUpdated ||
			eventName === JabberwockEventName.TaskCompleted
		) {
			await handleMetricsUpdate(options, payload, options.taskStartedAt.current)
		}

		if (eventName === JabberwockEventName.TaskAborted) {
			options.taskAbortedAt.current = Date.now()
		}

		if (eventName === JabberwockEventName.TaskCompleted) {
			options.taskFinishedAt.current = Date.now()
		}
	})

	client.on(IpcMessageType.Disconnect, () => {
		options.logger.info(`disconnected from IPC socket -> ${options.ipcSocketPath}`)
		options.isClientDisconnected.current = true
	})
}
