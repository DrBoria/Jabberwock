import type { ToolUsage, ToolName, NotificationSay } from "@jabberwock/types"
import { JabberwockEventName, IpcMessageType } from "@jabberwock/types"
import type { IpcClient } from "@jabberwock/ipc"

import { updateTask, createTaskMetrics, updateTaskMetrics, createToolError } from "../../db/index"

import { mergeToolUsage } from "../utils"

import type { VscodeTaskEventHandlerOptions } from "./taskEventHandlerTypes"

const LOGGABLE_SAYS: NotificationSay[] = [
	"error",
	"command_output",
	"rooignore_error",
	"diff_error",
	"condense_context",
	"condense_context_error",
	"api_req_rate_limit_wait",
	"api_req_retry_delayed",
	"api_req_retried",
]

function isApiRetryEvent(eventName: string, payload: unknown[]): boolean {
	return (
		eventName === JabberwockEventName.Message &&
		(payload[0] as { message: { say: string } }).message?.say != null &&
		["api_req_retry_delayed", "api_req_retried"].includes((payload[0] as { message: { say: string } }).message.say)
	)
}

function shouldLogEvent(eventName: string, payload: unknown[]): boolean {
	if (eventName === JabberwockEventName.Message) {
		const loggableSays = LOGGABLE_SAYS
		const message = (payload[0] as { message: { say?: string; partial?: boolean } }).message

		return (
			(message.say != null && loggableSays.includes(message.say as NotificationSay)) || message.partial !== true
		)
	}

	return true
}

function formatToolMessage(message: { ask?: string; text?: string }): string | undefined {
	if (message?.ask !== "tool") {
		return undefined
	}

	try {
		const textJson = JSON.parse(message.text ?? "{}")

		if (textJson.tool) {
			return `Message (tool: ${textJson.tool})`
		}
	} catch {
		// ignore parse errors
	}

	return undefined
}

function formatLogEventName(eventName: string, payload: unknown[]): string {
	if (eventName !== JabberwockEventName.Message) {
		return eventName
	}

	const message = (payload[0] as { message: { ask?: string; text?: string } }).message
	const toolFormatted = formatToolMessage(message)

	if (toolFormatted) {
		return toolFormatted
	}

	if (message?.ask === "command") {
		return `${eventName} (command)`
	}

	if (message?.ask === "completion_result") {
		return `${eventName} (completion_result)`
	}

	return eventName
}

async function handleVscodeTaskStarted(
	options: VscodeTaskEventHandlerOptions,
	payload: unknown[],
	taskId: number,
): Promise<void> {
	options.taskStartedAt.current = Date.now()

	const taskMetrics = await createTaskMetrics({
		cost: 0,
		tokensIn: 0,
		tokensOut: 0,
		tokensContext: 0,
		duration: 0,
		cacheWrites: 0,
		cacheReads: 0,
	})

	await updateTask(taskId, { taskMetricsId: taskMetrics.id, startedAt: new Date() })

	options.taskMetricsId.current = taskMetrics.id
	options.jabberwockTaskId.current = payload[0] as string
	options.resolveTaskMetricsReady()
}

async function handleVscodeMetricsUpdate(options: VscodeTaskEventHandlerOptions, payload: unknown[]): Promise<void> {
	await options.taskMetricsReady

	if (options.taskMetricsId.current == null) {
		options.logger.info(`skipping metrics update: taskMetricsId not set`)
		return
	}

	const duration = Date.now() - options.taskStartedAt.current

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

	await updateTaskMetrics(options.taskMetricsId.current, {
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

async function handleTaskEventLogging(
	options: VscodeTaskEventHandlerOptions,
	eventName: string,
	payload: unknown[],
): Promise<void> {
	if (!shouldLogEvent(eventName, payload)) {
		return
	}

	if (eventName === JabberwockEventName.Message) {
		const action = (payload[0] as { action?: string }).action
		const message = (payload[0] as { message?: Record<string, unknown> }).message

		if (!options.messageLogDeduper.shouldLog(action, message)) {
			return
		}
	}

	const logEventName = formatLogEventName(eventName, payload)
	options.logger.info(`${logEventName} ->`, payload)
}

async function handleTaskEventAction(
	options: VscodeTaskEventHandlerOptions,
	eventName: string,
	payload: unknown[],
	taskId: number,
): Promise<void> {
	if (eventName === JabberwockEventName.TaskStarted) {
		await handleVscodeTaskStarted(options, payload, taskId)
	}

	if (eventName === JabberwockEventName.TaskToolFailed) {
		const [, toolName, error] = payload
		await createToolError({ taskId, toolName: toolName as ToolName, error: error as string })
	}

	if (eventName === JabberwockEventName.TaskTokenUsageUpdated || eventName === JabberwockEventName.TaskCompleted) {
		await handleVscodeMetricsUpdate(options, payload)
	}

	if (eventName === JabberwockEventName.TaskAborted) {
		options.taskAbortedAt.current = Date.now()
	}

	if (eventName === JabberwockEventName.TaskCompleted) {
		options.taskFinishedAt.current = Date.now()
	}
}

export function registerVscodeTaskEventHandler({
	client,
	options,
	taskId,
}: {
	client: IpcClient
	options: VscodeTaskEventHandlerOptions
	taskId: number
}): void {
	client.on(IpcMessageType.TaskEvent, async (taskEvent) => {
		const { eventName, payload } = taskEvent

		if (isApiRetryEvent(eventName, payload ?? [])) {
			options.isApiUnstable.current = true
		}

		if (!options.ignoreEvents.broadcast.includes(eventName as JabberwockEventName)) {
			await options.publish({ ...taskEvent, taskId })
		}

		await handleTaskEventLogging(options, eventName, payload ?? [])
		await handleTaskEventAction(options, eventName, payload ?? [], taskId)
	})

	client.on(IpcMessageType.Disconnect, () => {
		options.logger.info(`disconnected from IPC socket -> ${options.ipcSocketPath}`)
		options.isClientDisconnected.current = true
		options.resolveTaskMetricsReady()
	})
}
