import { Anthropic } from "@anthropic-ai/sdk"

import {
	type ApiReqData,
	type Notification,
	getApiProtocol,
	getModelId,
	isRetiredProvider,
	ConsecutiveMistakeError,
} from "@jabberwock/types"
import { getTelemetryService } from "@jabberwock/telemetry"

import { findLastIndex } from "../../../../shared/array"
import { t } from "../../../../i18n"
import { formatResponse } from "../../../settings/context/responses"
import { defaultModeSlug, getModeBySlug } from "../../../../shared/modes"

import type { ITaskModel } from "../../../chat/task/store"
import type { IBackendRootStore } from "../../../store"
import { diagnosticsManager } from "@jabberwock/devtool"
import { getEnvironmentDetails } from "../../../chat/task/condense/actions/condenseContext"
import { processUserContentMentions } from "../../../chat/task/messages/actions/processUserContentMentions"

import { type TaskDelegate } from "../../../chat/task/condense/actions/types"
import { postStateToWebviewWithoutTaskHistory, handleModeSwitch } from "../../../foundation/window-manager/store"
import { getSkillsManager } from "../../../settings/skills/store"
import { getFileContextTracker } from "../../../foundation/time-machine/actions/getTimeMachine"
import { ask } from "../../../chat/task/notifications/actions/ask"
import { agentBroadcast, systemBroadcast } from "../../../chat/task/messages/actions/say"
import { saveMessages } from "../../../chat/task/messages/actions/persistMessages"
import { getBackendRootStore } from "@features/storeSingleton"
import { addToApiConversationHistory } from "../../../chat/task/messages/actions/apiHistoryPersistence"

import { getTask as getRegisteredTask } from "../../../chat/task/actions/taskRegistry"

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ApiRequestContext {
	taskId: string
	task: ITaskModel
	delegate: ITaskModel & TaskDelegate
	userContent: Anthropic.Messages.ContentBlockParam[]
	includeFileDetails: boolean
	retryAttempt: number
	userMessageWasRemoved: boolean
	/** Store reference — replaces getBackendRootStore() singleton calls. */
	store: IBackendRootStore
	/** IntentBus reference — for dispatching StreamStart/StreamEnd intents. */
	intentBus?: import("../../../intents/bus").IntentBus
}

// ── E.2: prepareApiRequest ─────────────────────────────────────────────────────

/**
 * Prepares the API request context from a task command.
 *
 * Handles:
 * - Mistake limit checking
 * - API protocol & rate limiting
 * - User content mentions processing
 * - Environment details gathering
 * - Initial API history setup
 */
export async function prepareApiRequest(
	taskId: string,
	userContent: Anthropic.Messages.ContentBlockParam[],
	includeFileDetails: boolean,
	retryAttempt: number = 0,
	userMessageWasRemoved: boolean = false,
	options?: { store?: IBackendRootStore; intentBus?: import("../../../intents/bus").IntentBus },
): Promise<ApiRequestContext> {
	const store = options?.store ?? getBackendRootStore()
	const task = getRegisteredTask(taskId)!
	const delegate = task as ITaskModel & TaskDelegate

	// Check abort state
	if (store.chat.abort) {
		throw new Error(`[prepareApiRequest] Task ${task.taskId} aborted`)
	}

	// ── Mistake limit check ──────────────────────────────────────────
	const consecutiveMistakeLimit = task._state.consecutiveMistakeLimit
	const consecutiveMistakeCount = task._state.consecutiveMistakeCount
	if (consecutiveMistakeLimit > 0 && consecutiveMistakeCount >= consecutiveMistakeLimit) {
		const tskConfig = delegate.apiConfiguration
		getTelemetryService().captureConsecutiveMistakeError(task.taskId)
		getTelemetryService().captureException(
			new ConsecutiveMistakeError(
				`Task reached consecutive mistake limit (${String(consecutiveMistakeLimit)})`,
				task.taskId,
				consecutiveMistakeCount,
				consecutiveMistakeLimit,
				"consecutive_mistake_tools_used",
				tskConfig.apiProvider as string | undefined,
				getModelId(tskConfig as Parameters<typeof getModelId>[0]),
			),
		)

		const { response, text, images } = await ask(
			task.taskId,
			"mistake_limit_reached",
			t("common:errors.mistake_limit_guidance"),
		)

		if (response === "messageResponse") {
			userContent = [
				...userContent,
				{ type: "text" as const, text: formatResponse.tooManyMistakes(text) },
				...formatResponse.imageBlocks(images),
			]

			await agentBroadcast(task.taskId, "api_req_feedback", text, images)
		}

		task._state.setConsecutiveMistakeCount(0)
	}

	// ── API protocol & rate limiting ─────────────────────────────────
	const tskConfig = delegate.apiConfiguration
	const modelId = getModelId(tskConfig as Parameters<typeof getModelId>[0])
	const apiProvider = tskConfig.apiProvider as Parameters<typeof getApiProtocol>[0]
	const apiProtocol = getApiProtocol(
		apiProvider && !isRetiredProvider(apiProvider as Parameters<typeof isRetiredProvider>[0])
			? apiProvider
			: undefined,
		modelId,
	)

	await delegate.maybeWaitForProviderRateLimit(retryAttempt)
	task.setLastApiRequestTime(performance.now())

	await systemBroadcast(task.taskId, "api_req_started", JSON.stringify({ apiProtocol }))

	// [TODO-LOG] Stream start
	const todoLogMsg = `[TODO-LOG] [Task] Stream start (taskId: ${task.taskId}, model: ${modelId})`
	console.log(todoLogMsg)
	diagnosticsManager.log(todoLogMsg, "info")

	const showJabberwockIgnoredFiles = false
	const includeDiagnosticMessages = true
	const maxDiagnosticMessages = 50
	const currentMode = task.taskMode

	// ── Process user content mentions ────────────────────────────────
	const { content: parsedUserContent, mode: slashCommandMode } = await processUserContentMentions({
		userContent,
		cwd: task.cwd,
		fileContextTracker: getFileContextTracker(),
		jabberwockIgnoreController: task.jabberwockIgnoreController,
		showJabberwockIgnoredFiles,
		includeDiagnosticMessages,
		maxDiagnosticMessages,
		skillsManager: getSkillsManager(store),
		currentMode,
	})

	// Switch mode if specified in a slash command's frontmatter
	if (slashCommandMode) {
		const providerRef = delegate.providerRef
		const providerRefValue = providerRef.deref()
		if (providerRefValue) {
			const customModes = store.settings.modes.customModes
			const targetMode = getModeBySlug(slashCommandMode, customModes)
			if (targetMode) {
				await handleModeSwitch(providerRefValue, slashCommandMode)
			}
		}
	}

	// ── Environment details ──────────────────────────────────────────
	diagnosticsManager.setCurrentAction(t("diagnostics:actions.environmentDetails"))
	const envStartTime = Date.now()
	console.log(`[DEBUG: TaskLoop#${task.taskId}] Phase: Environment Details Start`)
	const environmentDetails = await getEnvironmentDetails(task, includeFileDetails)
	console.log(`[DEBUG: TaskLoop#${task.taskId}] Phase: Environment Details Complete (${Date.now() - envStartTime}ms)`)

	// Remove any existing environment_details blocks before adding fresh ones.
	const contentWithoutEnvDetails = parsedUserContent.filter((block: Anthropic.Messages.ContentBlockParam) => {
		if (block.type === "text" && typeof block.text === "string") {
			const isEnvironmentDetailsBlock =
				(block.text as string).trim().startsWith("<environment_details>") &&
				(block.text as string).trim().endsWith("</environment_details>")
			return !isEnvironmentDetailsBlock
		}
		return true
	})

	// Add environment details as its own text block
	const finalUserContent = [...contentWithoutEnvDetails, { type: "text" as const, text: environmentDetails }]

	// Only add user message to conversation history if appropriate
	const isEmptyUserContent = userContent.length === 0
	const shouldAddUserMessage = (retryAttempt === 0 && !isEmptyUserContent) || userMessageWasRemoved
	if (shouldAddUserMessage) {
		await addToApiConversationHistory(task.taskId, task.globalStoragePath, task, {
			role: "user",
			content: finalUserContent,
		})
		getTelemetryService().captureConversationMessage(task.taskId, "user")
	}

	// Update the placeholder api_req_started message
	const taskModel = store.chat.tasks.get(taskId)!
	const storeMessages = [...taskModel.notifications.items]
	const lastApiReqIndex = findLastIndex(
		storeMessages,
		(m: (typeof storeMessages)[number]) => m.type === "say" && m.say === "api_req_started",
	)
	if (lastApiReqIndex !== -1) {
		storeMessages[lastApiReqIndex].text = JSON.stringify({
			apiProtocol,
		} satisfies ApiReqData)
	}

	await saveMessages(task.taskId)
	await postStateToWebviewWithoutTaskHistory(delegate.providerRef.deref()!)

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
