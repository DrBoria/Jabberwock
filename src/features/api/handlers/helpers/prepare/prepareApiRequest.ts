import { Anthropic } from "@anthropic-ai/sdk"

import { type Notification, type ApiReqData, getApiProtocol, getModelId, isRetiredProvider } from "@jabberwock/types"
import { getTelemetryService } from "@jabberwock/telemetry"

import { findLastIndex } from "@shared/array"
import { t } from "@i18n"

import type { ITaskModel } from "@features/chat/task/store"
import type { IBackendRootStore } from "@features/store"
import { diagnosticsManager } from "@jabberwock/devtool"

import { type TaskDelegate } from "@features/chat/task/condense/actions/types"
import { maybeWaitForProviderRateLimit } from "./rateLimit"
import { sendStateWithoutTaskHistory } from "@features/chat/task/messages/events/actions/sendMessageEvent"
import { systemBroadcast } from "@features/chat/task/messages/actions/say"
import { saveMessages } from "@features/chat/task/messages/actions/saveMessages"
import { getBackendRootStore } from "@features/storeSingleton"
import { addToApiConversationHistory } from "@features/chat/task/messages/actions/save/saveApiConversationHistory"

import { getTask as getRegisteredTask } from "@features/chat/task/actions/taskRegistry"
import { createAttemptApiRequest } from "./attemptApiRequest"
import { handleMistakeLimit, processUserContentWithEnv } from "./prepareApiRequestHelpers"

export interface ApiRequestContext {
	taskId: string
	task: ITaskModel
	delegate: ITaskModel & TaskDelegate
	userContent: Anthropic.Messages.ContentBlockParam[]
	includeFileDetails: boolean
	retryAttempt: number
	userMessageWasRemoved: boolean
	store: IBackendRootStore
	intentBus?: import("@features/intents/bus").IntentBus
}

/**
 * Resolves the API protocol from the task configuration.
 */
function resolveApiProtocol(task: ITaskModel & TaskDelegate): "anthropic" | "openai" {
	const tskConfig = task.apiConfiguration
	const modelId = getModelId(tskConfig as Parameters<typeof getModelId>[0])
	const apiProvider = tskConfig.apiProvider as Parameters<typeof getApiProtocol>[0]
	const effectiveProvider =
		apiProvider && !isRetiredProvider(apiProvider as Parameters<typeof isRetiredProvider>[0])
			? apiProvider
			: undefined
	return getApiProtocol(effectiveProvider, modelId)
}

/**
 * Wires the attemptApiRequest function on the task if not already set.
 */
function wireAttemptApiRequest(task: ITaskModel): void {
	if (typeof task.attemptApiRequest !== "function") {
		console.log(`[prepareApiRequest] Wiring attemptApiRequest on task ${task.taskId}`)
		task.setAttemptApiRequest((retryAttempt, opts) => createAttemptApiRequest(task, retryAttempt, opts))
	}
}

/**
 * Creates a stub delegate for rate-limit waiting.
 */
function createRateLimitDelegate(taskId: string): Parameters<typeof maybeWaitForProviderRateLimit>[1] {
	return {
		say: (type: string, ...args: unknown[]) =>
			systemBroadcast(
				taskId,
				type as Parameters<typeof systemBroadcast>[1],
				args[0] as string | undefined,
				args[1] as string[] | undefined,
				args[2] as boolean | undefined,
			),
		getSystemPrompt: async () => "",
		getEnvironmentDetails: async () => "",
		overwriteApiConversationHistory: async () => {},
		buildCleanConversationHistory: () => [],
		ask: async () => ({ response: "" }),
	}
}

/**
 * Updates the last api_req_started notification with the API protocol.
 */
function updateApiReqNotification(
	taskModel: import("@features/chat/task/store").ITaskModel,
	apiProtocol: "anthropic" | "openai",
): void {
	const lastApiReqIndex = findLastIndex(
		taskModel.notifications.items,
		(m) => m.type === "say" && m.say === "api_req_started",
	)
	if (lastApiReqIndex === -1) {
		return
	}
	taskModel.notifications.updateNotification(lastApiReqIndex, {
		...taskModel.notifications.items[lastApiReqIndex],
		text: JSON.stringify({ apiProtocol } satisfies ApiReqData),
	})
}

/**
 * Prepares the API request context from a task command.
 */
export async function prepareApiRequest(
	taskId: string,
	userContent: Anthropic.Messages.ContentBlockParam[],
	includeFileDetails: boolean,
	retryAttempt: number = 0,
	userMessageWasRemoved: boolean = false,
	options?: { store?: IBackendRootStore; intentBus?: import("@features/intents/bus").IntentBus },
): Promise<ApiRequestContext> {
	const store = options?.store ?? getBackendRootStore()
	const task = getRegisteredTask(taskId)!

	wireAttemptApiRequest(task)

	const delegate = task as ITaskModel & TaskDelegate

	if (store.chat.abort) {
		throw new Error(`[prepareApiRequest] Task ${task.taskId} aborted`)
	}

	userContent = await handleMistakeLimit(task, delegate, userContent)

	const apiProtocol = resolveApiProtocol(delegate)

	await maybeWaitForProviderRateLimit(task, createRateLimitDelegate(task.taskId), retryAttempt)
	task.setLastApiRequestTime(performance.now())

	await systemBroadcast(task.taskId, "api_req_started", JSON.stringify({ apiProtocol }))

	const todoLogMsg = `[TODO-LOG] [Task] Stream start (taskId: ${task.taskId}, model: ${getModelId(delegate.apiConfiguration as Parameters<typeof getModelId>[0])})`
	console.log(todoLogMsg)
	diagnosticsManager.log(todoLogMsg, "info")

	const { finalUserContent } = await processUserContentWithEnv(task, userContent, includeFileDetails, store)

	const shouldAddUserMessage = (retryAttempt === 0 && userContent.length > 0) || userMessageWasRemoved
	if (shouldAddUserMessage) {
		await addToApiConversationHistory(task.taskId, task.globalStoragePath, task, {
			role: "user",
			content: finalUserContent,
		})
		getTelemetryService().captureConversationMessage(task.taskId, "user")
	}

	const taskModel = store.chat.tasks.get(taskId)!
	updateApiReqNotification(taskModel, apiProtocol)

	await saveMessages(task.taskId)
	sendStateWithoutTaskHistory()

	return {
		taskId: task.taskId,
		task,
		delegate,
		userContent: finalUserContent,
		includeFileDetails,
		retryAttempt,
		userMessageWasRemoved,
		store,
		intentBus: options?.intentBus,
	}
}
