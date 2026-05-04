import * as vscode from "vscode"
import pWaitFor from "p-wait-for"
import { Anthropic } from "@anthropic-ai/sdk"
import {
	type HistoryItem,
	type CreateTaskOptions,
	type JabberwockSettings,
	MAX_MCP_TOOLS_THRESHOLD,
	JabberwockEventName,
} from "@jabberwock/types"
import { formatResponse } from "../../../../prompts/responses"
import { diagnosticsManager } from "@jabberwock/devtool"
import { getCheckpointService } from "../../../../checkpoints"
import { getModeBySlug, defaultModeSlug } from "../../../../../shared/modes"
import { Package } from "../../../../../shared/package"
import { ProfileValidator } from "../../../../../shared/ProfileValidator"
import { OrganizationAllowListViolationError } from "../../../../../utils/errors"
import { t } from "../../../../../i18n"
import type { ClineProvider } from "../../../../webview/ClineProvider"
import { Task } from "../../../../task/Task"

/**
 * Starts the task execution flow.
 * If the task has a message or images, it kicks off the async task loop.
 *
 * @param task - The Task instance
 */
import { createTimerQueueStore } from "../../../../features/foundation/timer-queue/store"

let _timerQueue: ReturnType<typeof createTimerQueueStore> | undefined

function getTimerQueue(): ReturnType<typeof createTimerQueueStore> {
	if (!_timerQueue) {
		_timerQueue = createTimerQueueStore()
	}
	return _timerQueue
}

export function start(task: Task): void {
	if (task._started) {
		return
	}
	task._started = true

	const { task: taskText, images } = task.metadata

	if (taskText || images) {
		startTask(task, taskText ?? undefined, images ?? undefined)
	}
}

/**
 * Initializes and starts the task with the given text and images.
 * Sets up conversation history, posts state to webview, announces the task,
 * checks for MCP tool limits, and kicks off the task loop.
 *
 * @param task - The Task instance
 * @param taskText - Optional task text
 * @param images - Optional array of image data URIs
 */
async function startTask(task: Task, taskText?: string, images?: string[]): Promise<void> {
	try {
		// `conversationHistory` (for API) and `clineMessages` (for webview)
		// need to be in sync.
		// If the extension process were killed, then on restart the
		// `clineMessages` might not be empty, so we need to set it to [] when
		// we create a new Cline client (otherwise webview would show stale
		// messages from previous session).
		task.clineMessages = []
		task.apiConversationHistory = []

		// The todo list is already set in the constructor if initialTodos were provided
		// No need to add any messages - the todoList property is already set

		await task.providerRef.deref()?.postStateToWebviewWithoutTaskHistory()

		await task.say("text", taskText, images)

		// Check for too many MCP tools and warn the user
		const { enabledToolCount, enabledServerCount } = await task.getEnabledMcpToolsCount()
		if (enabledToolCount > MAX_MCP_TOOLS_THRESHOLD) {
			await task.say(
				"too_many_tools_warning",
				JSON.stringify({
					toolCount: enabledToolCount,
					serverCount: enabledServerCount,
					threshold: MAX_MCP_TOOLS_THRESHOLD,
				}),
				undefined,
				undefined,
				undefined,
				undefined,
				{ isNonInteractive: true },
			)
		}
		task.isInitialized = true

		const imageBlocks: Anthropic.ImageBlockParam[] = formatResponse.imageBlocks(images)

		// Task starting
		await initiateTaskLoop(task, [
			{
				type: "text",
				text: `<user_message>\n${taskText}\n</user_message>`,
			},
			...imageBlocks,
		]).catch((error) => {
			// Swallow loop rejection when the task was intentionally abandoned/aborted
			// during delegation or user cancellation to prevent unhandled rejections.
			if (task.abandoned === true || task.abortReason === "user_cancelled") {
				return
			}
			throw error
		})
	} catch (error) {
		// In tests and some UX flows, tasks can be aborted while `startTask` is still
		// initializing. Treat abort/abandon as expected and avoid unhandled rejections.
		if (task.abandoned === true || task.abort === true || task.abortReason === "user_cancelled") {
			return
		}
		throw error
	}
}

/**
 * Initiates the main task loop.
 * Kicks off checkpoint initialization, emits TaskStarted event,
 * and runs the recursive request loop until completion or abort.
 *
 * @param task - The Task instance
 * @param userContent - The initial user content blocks
 */
export async function initiateTaskLoop(task: Task, userContent: Anthropic.Messages.ContentBlockParam[]): Promise<void> {
	task.turnResetPending = false
	// Kicks off the checkpoints initialization process in the background.
	getCheckpointService(task)

	let nextUserContent = userContent
	let includeFileDetails = true

	task.emit(JabberwockEventName.TaskStarted)
	diagnosticsManager.recordTaskStart(
		task.taskId,
		"primary",
		userContent.map((c) => ("text" in c ? c.text : "[Media]")).join("\n"),
	)

	while (!task.abort) {
		const didEndLoop = await task.recursivelyMakeClineRequests(nextUserContent, includeFileDetails)
		includeFileDetails = false // We only need file details the first time.

		if (didEndLoop) {
			// For now a task never 'completes'. This will only happen if
			// the user hits max requests and denies resetting the count.
			break
		} else {
			nextUserContent = [{ type: "text", text: formatResponse.noToolsUsed() }]
		}
	}
	diagnosticsManager.recordTaskEnd(task.taskId, task.abort ? "aborted" : "completed")
}

/**
 * Creates a new task with the given parameters.
 * Handles configuration, mode selection, API configuration loading,
 * and task instantiation with stack management.
 */
export async function createTask(
	provider: ClineProvider,
	text?: string,
	images?: string[],
	parentTask?: Task,
	options: CreateTaskOptions = {},
	configuration: JabberwockSettings = {},
): Promise<Task> {
	if (configuration) {
		await provider.setValues(configuration)

		if (configuration.allowedCommands) {
			await vscode.workspace
				.getConfiguration(Package.name)
				.update("allowedCommands", configuration.allowedCommands, vscode.ConfigurationTarget.Global)
		}

		if (configuration.deniedCommands) {
			await vscode.workspace
				.getConfiguration(Package.name)
				.update("deniedCommands", configuration.deniedCommands, vscode.ConfigurationTarget.Global)
		}

		if (configuration.commandExecutionTimeout !== undefined) {
			await vscode.workspace
				.getConfiguration(Package.name)
				.update(
					"commandExecutionTimeout",
					configuration.commandExecutionTimeout,
					vscode.ConfigurationTarget.Global,
				)
		}

		if (configuration.currentApiConfigName) {
			await provider.setProviderProfile(configuration.currentApiConfigName)
		}

		if (configuration.customModes?.length) {
			for (const mode of configuration.customModes) {
				await provider.customModesManager.updateCustomMode(mode.slug, mode)
			}
		}
	}

	const { mode: optionsMode, ...otherOptions } = options

	const getStateTimeoutId = `get-state-timeout-${Date.now()}`
	getTimerQueue().schedule({
		id: getStateTimeoutId,
		label: "Get state timeout (startTask)",
		timeoutMs: 5000,
	})
	const state = await Promise.race([
		provider.getState(),
		getTimerQueue()
			.createAbortPromise(getStateTimeoutId)
			.then(() => null),
	])
	getTimerQueue().cancel(getStateTimeoutId)

	const {
		apiConfiguration: baseApiConfiguration,
		organizationAllowList,
		enableCheckpoints,
		checkpointTimeout,
		experiments,
	} = state ?? {
		apiConfiguration: {} as any,
		organizationAllowList: "allow-all" as any,
		enableCheckpoints: true,
		checkpointTimeout: 300,
		experiments: {} as any,
	}

	let apiConfiguration = baseApiConfiguration
	if (optionsMode) {
		try {
			const configId = await provider.providerSettingsManager.getModeConfigId(optionsMode)
			if (configId) {
				const profile = await provider.providerSettingsManager.getProfile({ id: configId })
				if (profile) {
					const { name, id, ...settings } = profile
					apiConfiguration = settings as any
				}
			}
		} catch (error) {
			console.error(`Failed to load api config for mode ${optionsMode}:`, error)
		}
	}

	// Single-open-task invariant: always enforce for user-initiated top-level tasks
	if (!parentTask) {
		try {
			await provider.removeClineFromStack()
		} catch {
			// Non-fatal
		}
	}

	if (!ProfileValidator.isProfileAllowed(apiConfiguration, organizationAllowList)) {
		throw new OrganizationAllowListViolationError(t("common:errors.violated_organization_allowlist"))
	}

	const task = new Task({
		provider: provider as any,
		apiConfiguration,
		enableCheckpoints,
		checkpointTimeout,
		consecutiveMistakeLimit: apiConfiguration.consecutiveMistakeLimit,
		task: text,
		images,
		experiments,
		rootTask: provider.clineStack.length > 0 ? provider.clineStack[0] : undefined,
		parentTask,
		taskNumber: provider.clineStack.length + 1,
		onCreated: provider.taskCreationCallback,
		initialTodos: options.initialTodos,
		mode: optionsMode,
		startTask: false,
		...otherOptions,
	})

	await provider.addClineToStack(task)
	task.start()

	return task
}

/**
 * Cancels the current task.
 * Aborts the running task, waits for it to stop streaming,
 * and rehydrates from history if available.
 */
export async function cancelTask(provider: ClineProvider): Promise<void> {
	const task = provider.getCurrentTask()

	if (!task) {
		return
	}

	console.log(`[cancelTask] cancelling task ${task.taskId}.${task.instanceId}`)

	let historyItem: HistoryItem | undefined
	try {
		const history = await provider.getTaskWithId(task.taskId)
		historyItem = history.historyItem
	} catch (error: any) {
		if (error instanceof Error && error.message === "Task not found") {
			provider.log(`[cancelTask] task history missing for ${task.taskId}; skipping rehydrate`)
		} else {
			throw error
		}
	}

	const rootTask = task.rootTask
	const parentTask = task.parentTask

	task.abortReason = "user_cancelled"
	const originalInstanceId = task.instanceId

	task.cancelCurrentRequest()
	task.abortTask()
	task.abandoned = true

	await pWaitFor(
		() =>
			provider.getCurrentTask()! === undefined ||
			provider.getCurrentTask()!.isStreaming === false ||
			provider.getCurrentTask()!.didFinishAbortingStream ||
			provider.getCurrentTask()!.isWaitingForFirstChunk,
		{
			timeout: 3_000,
		},
	).catch(() => {
		console.error("Failed to abort task")
	})

	const current = provider.getCurrentTask()
	if (current && current.instanceId !== originalInstanceId) {
		provider.log(
			`[cancelTask] Skipping rehydrate: current instance ${current.instanceId} != original ${originalInstanceId}`,
		)
		return
	}

	{
		const currentAfterCheck = provider.getCurrentTask()
		if (currentAfterCheck && currentAfterCheck.instanceId !== originalInstanceId) {
			provider.log(
				`[cancelTask] Skipping rehydrate after final check: current instance ${currentAfterCheck.instanceId} != original ${originalInstanceId}`,
			)
			return
		}
	}

	if (!historyItem) {
		return
	}

	await provider.createTaskWithHistoryItem({ ...historyItem, rootTask, parentTask })
}

/**
 * Resumes a task by its ID.
 * Delegates to showTaskWithId to handle both current and historical tasks.
 */
export function resumeTask(provider: ClineProvider, taskId: string): void {
	provider.showTaskWithId(taskId).catch((error: Error) => {
		provider.log(`Failed to resume task ${taskId}: ${error.message}`)
	})
}

/**
 * Creates a task from a history item, restoring its state.
 * Handles mode restoration, API config restoration, task rehydration,
 * and pending edit operations.
 */
export async function createTaskWithHistoryItem(
	provider: ClineProvider,
	historyItem: HistoryItem & { rootTask?: Task; parentTask?: Task },
	options?: { startTask?: boolean },
) {
	const isCliRuntime = process.env.JABBERWOCK_CLI_RUNTIME === "1"
	const skipProfileRestoreFromHistory = isCliRuntime

	const currentTask = provider.getCurrentTask()
	const isRehydratingCurrentTask = currentTask && currentTask.taskId === historyItem.id

	if (!isRehydratingCurrentTask) {
		await provider.removeClineFromStack()
	}

	if (historyItem.mode) {
		const customModes = await provider.customModesManager.getCustomModes()
		const modeExists = getModeBySlug(historyItem.mode, customModes) !== undefined

		if (!modeExists) {
			provider.log(
				`Mode '${historyItem.mode}' from history no longer exists. Falling back to default mode '${defaultModeSlug}'.`,
			)
			historyItem.mode = defaultModeSlug
		}

		await provider.updateGlobalState("mode", historyItem.mode)

		const lockApiConfigAcrossModes = provider.context.workspaceState.get("lockApiConfigAcrossModes", false)

		if (!historyItem.apiConfigName && !lockApiConfigAcrossModes && !skipProfileRestoreFromHistory) {
			const savedConfigId = await provider.providerSettingsManager.getModeConfigId(historyItem.mode)
			const listApiConfig = await provider.providerSettingsManager.listConfig()

			await provider.updateGlobalState("listApiConfigMeta", listApiConfig)

			if (savedConfigId) {
				const profile = listApiConfig.find(({ id }: any) => id === savedConfigId)

				if (profile?.name) {
					try {
						const fullProfile = await provider.providerSettingsManager.getProfile({ name: profile.name })
						const hasActualSettings = !!fullProfile.apiProvider

						if (hasActualSettings) {
							await provider.activateProviderProfile({ name: profile.name })
						}
					} catch (error) {
						provider.log(
							`Failed to restore API configuration for mode '${historyItem.mode}': ${
								error instanceof Error ? error.message : String(error)
							}. Continuing with default configuration.`,
						)
					}
				}
			}
		}
	}

	if (historyItem.apiConfigName && !skipProfileRestoreFromHistory) {
		const listApiConfig = await provider.providerSettingsManager.listConfig()
		await provider.updateGlobalState("listApiConfigMeta", listApiConfig)
		const profile = listApiConfig.find(({ name }: any) => name === historyItem.apiConfigName)

		if (profile?.name) {
			try {
				await provider.activateProviderProfile(
					{ name: profile.name },
					{ persistModeConfig: false, persistTaskHistory: false },
				)
			} catch (error) {
				provider.log(
					`Failed to restore API configuration '${historyItem.apiConfigName}' for task: ${
						error instanceof Error ? error.message : String(error)
					}. Continuing with current configuration.`,
				)
			}
		} else {
			provider.log(
				`Provider profile '${historyItem.apiConfigName}' from history no longer exists. Using current configuration.`,
			)
		}
	} else if (historyItem.apiConfigName && skipProfileRestoreFromHistory) {
		provider.log(
			`Skipping restore of provider profile '${historyItem.apiConfigName}' for task ${historyItem.id} in CLI runtime.`,
		)
	}

	const { apiConfiguration, enableCheckpoints, checkpointTimeout, experiments } = await provider.getState()

	const task = new Task({
		provider: provider as any,
		apiConfiguration,
		enableCheckpoints,
		checkpointTimeout,
		consecutiveMistakeLimit: apiConfiguration.consecutiveMistakeLimit,
		historyItem,
		experiments,
		rootTask: historyItem.rootTask,
		parentTask: historyItem.parentTask,
		taskNumber: historyItem.number,
		workspacePath: historyItem.workspace,
		onCreated: provider.taskCreationCallback,
		startTask: options?.startTask ?? true,
		initialStatus: historyItem.status,
	})

	if (isRehydratingCurrentTask) {
		const stackIndex = provider.clineStack.length - 1
		const oldTask = provider.clineStack[stackIndex]

		try {
			await oldTask.abortTask(true)
		} catch (e: any) {
			provider.log(
				`[createTaskWithHistoryItem] abortTask() failed for old task ${oldTask.taskId}.${oldTask.instanceId}: ${e.message}`,
			)
		}

		const cleanupFunctions = provider.taskEventListeners.get(oldTask)
		if (cleanupFunctions) {
			cleanupFunctions.forEach((cleanup) => cleanup())
			provider.taskEventListeners.delete(oldTask)
		}

		provider.clineStack[stackIndex] = task
		task.emit(JabberwockEventName.TaskFocused)

		await provider.performPreparationTasks(task)

		provider.log(
			`[createTaskWithHistoryItem] rehydrated task ${task.taskId}.${task.instanceId} in-place (flicker-free)`,
		)
	} else {
		await provider.addClineToStack(task)

		provider.log(
			`[createTaskWithHistoryItem] ${task.parentTask ? "child" : "parent"} task ${task.taskId}.${task.instanceId} instantiated`,
		)
	}

	const operationId = `task-${task.taskId}`
	const pendingEdit = provider.getPendingEditOperation(operationId)
	if (pendingEdit) {
		provider.clearPendingEditOperation(operationId)

		provider.log(`[createTaskWithHistoryItem] Processing pending edit after checkpoint restoration`)

		const pendingEditTimeoutId = `pending-edit-${task.taskId}-${Date.now()}`
		getTimerQueue().schedule({
			id: pendingEditTimeoutId,
			label: "Pending edit timeout (startTask)",
			timeoutMs: 100,
		})
		getTimerQueue()
			.createAbortPromise(pendingEditTimeoutId)
			.then(async () => {
				try {
					const { messageIndex, apiConversationHistoryIndex } = (() => {
						const messageIndex = task.clineMessages.findIndex(
							(msg: any) => msg.ts === pendingEdit.messageTs,
						)
						const apiConversationHistoryIndex = task.apiConversationHistory.findIndex(
							(msg: any) => msg.ts === pendingEdit.messageTs,
						)
						return { messageIndex, apiConversationHistoryIndex }
					})()

					if (messageIndex !== -1) {
						await task.overwriteClineMessages(task.clineMessages.slice(0, messageIndex))

						if (apiConversationHistoryIndex !== -1) {
							await task.overwriteApiConversationHistory(
								task.apiConversationHistory.slice(0, apiConversationHistoryIndex),
							)
						}

						await task.handleWebviewAskResponse(
							"messageResponse",
							pendingEdit.editedContent,
							pendingEdit.images,
						)
					}
				} catch (error) {
					provider.log(`[createTaskWithHistoryItem] Error processing pending edit: ${error}`)
				}
			})
	}

	return task
}
