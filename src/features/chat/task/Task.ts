import * as path from "path"
import * as fs from "fs"
import * as vscode from "vscode"
import os from "os"
import crypto from "crypto"
import { v7 as uuidv7 } from "uuid"
import EventEmitter from "events"

import { AskIgnoredError } from "../../../core/task/AskIgnoredError"

import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"
import debounce from "lodash.debounce"
import delay from "delay"
import pWaitFor from "p-wait-for"
import { serializeError } from "serialize-error"
import { Package } from "../../../shared/package"
import { formatToolInvocation } from "../../../core/tools/helpers/toolResultFormatting"
import { postStateToWebviewWithoutTaskHistory } from "../../foundation/window-manager/store"

import {
	type TaskLike,
	type TaskMetadata,
	type TaskEvents,
	type ProviderSettings,
	type TokenUsage,
	type ToolUsage,
	type ToolName,
	type ContextCondense,
	type ContextTruncation,
	type ClineMessage,
	type ClineSay,
	type ClineAsk,
	type ToolProgressStatus,
	type HistoryItem,
	type CreateTaskOptions,
	type ModelInfo,
	type ClineApiReqCancelReason,
	type ClineApiReqInfo,
	JabberwockEventName,
	TelemetryEventName,
	TaskStatus,
	TodoItem,
	getApiProtocol,
	getModelId,
	isRetiredProvider,
	isIdleAsk,
	isInteractiveAsk,
	isResumableAsk,
	QueuedMessage,
	DEFAULT_CONSECUTIVE_MISTAKE_LIMIT,
	DEFAULT_CHECKPOINT_TIMEOUT_SECONDS,
	MAX_CHECKPOINT_TIMEOUT_SECONDS,
	MIN_CHECKPOINT_TIMEOUT_SECONDS,
	ConsecutiveMistakeError,
	MAX_MCP_TOOLS_THRESHOLD,
	countEnabledMcpTools,
} from "@jabberwock/types"
import { TelemetryService, getTelemetryService } from "@jabberwock/telemetry"
import { CloudService } from "@jabberwock/cloud"

// api
import { ApiHandler, ApiHandlerCreateMessageMetadata, buildApiHandler } from "../../../api"
import { ApiStream, ApiStreamChunk, GroundingSource } from "../../../api/transform/stream"
import { maybeRemoveImageBlocks } from "../../../api/transform/image-cleaning"

// shared
import { findLastIndex } from "../../../shared/array"
import { combineApiRequests } from "../../../shared/combineApiRequests"
import { combineCommandSequences } from "../../../shared/combineCommandSequences"
import { t } from "../../../i18n"
import { getApiMetrics, hasTokenUsageChanged, hasToolUsageChanged } from "../../../shared/getApiMetrics"
import { ClineAskResponse } from "../../../shared/WebviewMessage"
import { defaultModeSlug, getModeBySlug } from "../../../shared/modes"
import { DiffStrategy, type ToolUse, type ToolParamName, toolParamNames } from "../../../shared/tools"
import { getModelMaxOutputTokens } from "../../../shared/api"

// services
import { McpHub } from "../../../services/mcp/McpHub"
import { McpServerManager, getMcpServerManager } from "../../../services/mcp/McpServerManager"
import { RepoPerTaskCheckpointService } from "../../../services/checkpoints"

// integrations
import { DiffViewProvider } from "../../../integrations/editor/DiffViewProvider"
import { findToolName } from "../../../integrations/misc/export-markdown"
import { JabberwockTerminalProcess } from "../../../integrations/terminal/types"
import { TerminalRegistry } from "../../../integrations/terminal/TerminalRegistry"
import { OutputInterceptor } from "../../../integrations/terminal/OutputInterceptor"

// utils
import { calculateApiCostAnthropic, calculateApiCostOpenAI } from "../../../shared/cost"
import { getWorkspacePath } from "../../../utils/path"
import { sanitizeToolUseId } from "../../../utils/tool-id"
import { getTaskDirectoryPath } from "../../../utils/storage"

// prompts
import { formatResponse } from "../../../core/prompts/responses"
import { SYSTEM_PROMPT } from "../../../core/prompts/system"
import { buildNativeToolsArrayWithRestrictions } from "../../../core/task/build-tools"

// core modules
import { ToolRepetitionDetector } from "../../../core/tools/ToolRepetitionDetector"
import { restoreTodoListForTask } from "../../../core/tools/UpdateTodoListTool"
import { FileContextTracker } from "../../../core/context-tracking/FileContextTracker"
import { JabberwockIgnoreController } from "../../../core/ignore/JabberwockIgnoreController"
import { JabberwockProtectedController } from "../../../core/protect/JabberwockProtectedController"
import { VirtualWorkspace } from "../../../core/fs/VirtualWorkspace"
import { type AssistantMessageContent, presentAssistantMessage } from "../../../core/assistant-message"
import { NativeToolCallParser } from "../../../core/assistant-message/NativeToolCallParser"
import { manageContext, willManageContext } from "../../../core/context-management"
import { EventBridge } from "../../../core/webview/EventBridge"
import { MultiSearchReplaceDiffStrategy } from "../../../core/diff/strategies/multi-search-replace"
import {
	type ApiMessage,
	readApiMessages,
	saveApiMessages,
	readTaskMessages,
	saveTaskMessages,
	taskMetadata,
} from "../../../core/task-persistence"
import { getEnvironmentDetails } from "../../../core/environment/getEnvironmentDetails"
import { checkContextWindowExceededError } from "../../../core/context/context-management/context-error-handling"
import {
	type CheckpointDiffOptions,
	type CheckpointRestoreOptions,
	getCheckpointService,
	checkpointSave,
	checkpointRestore,
	checkpointDiff,
} from "../../../core/checkpoints"
import { processUserContentMentions } from "../../../core/mentions/processUserContentMentions"
import { getMessagesSinceLastSummary, summarizeConversation, getEffectiveApiHistory } from "../../../core/condense"
import { MessageQueueService } from "../../../core/message-queue/MessageQueueService"
import { AutoApprovalHandler, checkAutoApproval } from "../../../core/auto-approval"
import { MessageManager } from "../../../core/message-manager"
import { validateAndFixToolResultIds } from "../../../core/task/validateToolResultIds"
import { mergeConsecutiveApiMessages } from "../../../core/task/mergeConsecutiveApiMessages"
import { diagnosticsManager } from "@jabberwock/devtool"
import { overwriteApiConversationHistory as overwriteApiConversationHistoryAction } from "./actions/overwriteApiHistory"
import { processQueuedMessages as processQueuedMessagesAction } from "./actions/processQueuedMessages"
import {
	saveApiConversationHistory as saveApiConversationHistoryAction,
	addToClineMessages as addToClineMessagesAction,
	overwriteClineMessages as overwriteClineMessagesAction,
	updateClineMessage as updateClineMessageAction,
	saveClineMessages as saveClineMessagesAction,
	findMessageByTimestamp as findMessageByTimestampAction,
} from "./utils/messagePersistence"
import { addToApiConversationHistory as addToApiConversationHistoryAction } from "./utils/messageUtils"
import { flushPendingToolResultsToHistory as flushPendingToolResultsToHistoryFromUtils } from "./utils/flushPendingToolResults"
import {
	getEnabledMcpToolsCount as getEnabledMcpToolsCountFromUtils,
	resolveElicitation as resolveElicitationFromUtils,
} from "./utils/mcpIntegration"
import { pushToolResultToUserContent as pushToolResultToUserContentFromUtils } from "./utils/streaming"
import {
	recordToolUsage as recordToolUsageFromUtils,
	recordToolError as recordToolErrorFromUtils,
	getTokenUsage as getTokenUsageFromUtils,
	getTaskStatus as getTaskStatusFromUtils,
} from "./utils/metrics"
import { condenseContext as condenseContextAction } from "./utils/condenseContext"
import { buildCleanConversationHistory as buildCleanConversationHistoryAction } from "./utils/conversationCleaner"
import { getSystemPrompt as getSystemPromptAction } from "./utils/systemPrompt"
import { resumeTaskFromHistory as resumeTaskFromHistoryAction } from "./utils/resumeTask"
import {
	attemptApiRequest as attemptApiRequestAction,
	handleContextWindowExceededError as handleContextWindowExceededErrorAction,
	backoffAndAnnounce as backoffAndAnnounceAction,
	maybeWaitForProviderRateLimit as maybeWaitForProviderRateLimitAction,
} from "./utils/attemptApiRequest"
// NOTE: ask, say, handleWebviewAskResponse, and sayAndCreateMissingParamError
// are implemented inline in this class to avoid circular delegation with
// the store.ts counterparts (which delegate back to Task methods).
import { runMainLoop } from "./utils/mainLoop"
const MAX_EXPONENTIAL_BACKOFF_SECONDS = 600 // 10 minutes
const DEFAULT_USAGE_COLLECTION_TIMEOUT_MS = 5000 // 5 seconds
const FORCED_CONTEXT_REDUCTION_PERCENT = 75 // Keep 75% of context (remove 25%) on context window errors
const MAX_CONTEXT_WINDOW_RETRIES = 3 // Maximum retries for context window errors

export interface TaskOptions extends CreateTaskOptions {
	provider: EventBridge
	apiConfiguration: ProviderSettings
	enableCheckpoints?: boolean
	checkpointTimeout?: number
	consecutiveMistakeLimit?: number
	task?: string
	images?: string[]
	historyItem?: HistoryItem
	experiments?: Record<string, boolean>
	startTask?: boolean
	rootTask?: Task
	parentTask?: Task
	taskNumber?: number
	onCreated?: (task: Task) => void
	initialTodos?: TodoItem[]
	workspacePath?: string
	/** Initial status for the task's history item (e.g., "active" for child tasks) */
	initialStatus?: "active" | "delegated" | "completed"
	mode?: string // Jabberwock: async orchestration
}

import { start as startTaskAction } from "./actions/startTask"

import { abortTask as abortTaskAction, dispose as disposeAction } from "./actions/taskLifecycle"

import {
	startSubtask as startSubtaskAction,
	resumeAfterDelegation as resumeAfterDelegationAction,
} from "./actions/delegation"

import { submitUserMessage as submitUserMessageAction } from "./actions/submitUserMessage"
import { getTimerQueue } from "../../foundation/timer-queue/getTimerQueue"
import {
	ask as askFromUtils,
	say as sayFromUtils,
	handleWebviewAskResponse as handleWebviewAskResponseFromUtils,
	approveAsk as approveAskFromUtils,
	denyAsk as denyAskFromUtils,
	supersedePendingAsk as supersedePendingAskFromUtils,
	cancelAutoApprovalTimeout as cancelAutoApprovalTimeoutFromUtils,
	sayAndCreateMissingParamError as sayAndCreateMissingParamErrorFromUtils,
} from "./utils/messaging"

import type { ChatStoreType } from "../../../core/state/ChatTreeStore"

export class Task extends EventEmitter<TaskEvents> implements TaskLike {
	readonly taskId: string
	readonly rootTaskId?: string
	readonly parentTaskId?: string
	childTaskId?: string
	childTaskIds: string[] = [] // Jabberwock: support multiple children
	childTasks: Task[] = [] // Jabberwock: hold references to background tasks
	completionResultSummary?: string // Jabberwock: result of attempt_completion
	isCompleted: boolean = false // Jabberwock: track if task is completed
	isAsync: boolean = false // Jabberwock: true if task runs in background (async orchestration)
	pendingNewTaskToolCallId?: string

	readonly instanceId: string
	readonly metadata: TaskMetadata

	todoList?: TodoItem[]

	readonly rootTask: Task | undefined = undefined
	readonly parentTask: Task | undefined = undefined
	readonly taskNumber: number
	readonly workspacePath: string
	readonly virtualWorkspace: VirtualWorkspace

	/**
	 * The mode associated with this task. Persisted across sessions
	 * to maintain user context when reopening tasks from history.
	 *
	 * ## Lifecycle
	 *
	 * ### For new tasks:
	 * 1. Initially `undefined` during construction
	 * 2. Asynchronously initialized from provider state via `initializeTaskMode()`
	 * 3. Falls back to `defaultModeSlug` if provider state is unavailable
	 *
	 * ### For history items:
	 * 1. Immediately set from `historyItem.mode` during construction
	 * 2. Falls back to `defaultModeSlug` if mode is not stored in history
	 *
	 * ## Important
	 * This property should NOT be accessed directly until `taskModeReady` promise resolves.
	 * Use `getTaskMode()` for async access or `taskMode` getter for sync access after initialization.
	 *
	 * @private
	 * @see {@link getTaskMode} - For safe async access
	 * @see {@link taskMode} - For sync access after initialization
	 * @see {@link waitForModeInitialization} - To ensure initialization is complete
	 */
	_taskMode: string | undefined

	/**
	 * Promise that resolves when the task mode has been initialized.
	 * This ensures async mode initialization completes before the task is used.
	 *
	 * ## Purpose
	 * - Prevents race conditions when accessing task mode
	 * - Ensures provider state is properly loaded before mode-dependent operations
	 * - Provides a synchronization point for async initialization
	 *
	 * ## Resolution timing
	 * - For history items: Resolves immediately (sync initialization)
	 * - For new tasks: Resolves after provider state is fetched (async initialization)
	 *
	 * @private
	 * @see {@link waitForModeInitialization} - Public method to await this promise
	 */
	taskModeReady: Promise<void>

	/**
	 * Monotonic timestamp generator to prevent React key collisions in the webview.
	 * Ensures every message issued by this task has a unique timestamp.
	 */
	private lastUsedTs: number = 0
	public generateUniqueTs(): number {
		const now = Date.now()
		const ts = Math.max(now, this.lastUsedTs + 1)
		this.lastUsedTs = ts
		return ts
	}

	/**
	 * The API configuration name (provider profile) associated with this task.
	 * Persisted across sessions to maintain the provider profile when reopening tasks from history.
	 *
	 * ## Lifecycle
	 *
	 * ### For new tasks:
	 * 1. Initially `undefined` during construction
	 * 2. Asynchronously initialized from provider state via `initializeTaskApiConfigName()`
	 * 3. Falls back to "default" if provider state is unavailable
	 *
	 * ### For history items:
	 * 1. Immediately set from `historyItem.apiConfigName` during construction
	 * 2. Falls back to undefined if not stored in history (for backward compatibility)
	 *
	 * ## Important
	 * If you need a non-`undefined` provider profile (e.g., for profile-dependent operations),
	 * wait for `taskApiConfigReady` first (or use `getTaskApiConfigName()`).
	 * The sync `taskApiConfigName` getter may return `undefined` for backward compatibility.
	 *
	 * @private
	 * @see {@link getTaskApiConfigName} - For safe async access
	 * @see {@link taskApiConfigName} - For sync access after initialization
	 */
	_taskApiConfigName: string | undefined

	/**
	 * Promise that resolves when the task API config name has been initialized.
	 * This ensures async API config name initialization completes before the task is used.
	 *
	 * ## Purpose
	 * - Prevents race conditions when accessing task API config name
	 * - Ensures provider state is properly loaded before profile-dependent operations
	 * - Provides a synchronization point for async initialization
	 *
	 * ## Resolution timing
	 * - For history items: Resolves immediately (sync initialization)
	 * - For new tasks: Resolves after provider state is fetched (async initialization)
	 *
	 * @private
	 */
	taskApiConfigReady: Promise<void>

	providerRef: WeakRef<EventBridge>
	readonly globalStoragePath: string
	abort: boolean = false
	turnResetPending: boolean = false
	currentRequestAbortController?: AbortController
	skipPrevResponseIdOnce: boolean = false

	// TaskStatus
	idleAsk?: ClineMessage
	resumableAsk?: ClineMessage
	interactiveAsk?: ClineMessage

	didFinishAbortingStream = false
	abandoned = false
	abortReason?: ClineApiReqCancelReason
	isInitialized = false
	isPaused: boolean = false

	// API
	apiConfiguration: ProviderSettings
	api: ApiHandler
	static lastGlobalApiRequestTime?: number
	public autoApprovalHandler: AutoApprovalHandler

	/**
	 * Reset the global API request timestamp. This should only be used for testing.
	 * @internal
	 */
	static resetGlobalApiRequestTime(): void {
		Task.lastGlobalApiRequestTime = undefined
	}

	toolRepetitionDetector: ToolRepetitionDetector
	jabberwockIgnoreController?: JabberwockIgnoreController
	jabberwockProtectedController?: JabberwockProtectedController
	fileContextTracker: FileContextTracker
	terminalProcess?: JabberwockTerminalProcess

	// Editing
	diffViewProvider: DiffViewProvider
	diffStrategy?: DiffStrategy
	didEditFile: boolean = false

	// LLM Messages & Chat Messages
	apiConversationHistory: ApiMessage[] = []
	clineMessages: ClineMessage[] = []

	// Ask
	askResponse?: ClineAskResponse
	public getAskResponse(): ClineAskResponse | undefined {
		return this.askResponse
	}
	askResponseText?: string
	askResponseImages?: string[]
	public askShownAt?: number // Jabberwock: Interruption Engineering
	public lastMessageTs?: number
	public autoApprovalTimeoutRef?: NodeJS.Timeout

	// Tool Use
	consecutiveMistakeCount: number = 0
	consecutiveMistakeLimit: number
	consecutiveMistakeCountForApplyDiff: Map<string, number> = new Map()
	consecutiveMistakeCountForEditFile: Map<string, number> = new Map()
	consecutiveNoToolUseCount: number = 0
	consecutiveNoAssistantMessagesCount: number = 0
	toolUsage: ToolUsage = {}

	// Checkpoints
	enableCheckpoints: boolean
	checkpointTimeout: number
	checkpointService?: RepoPerTaskCheckpointService
	checkpointServiceInitializing = false

	// Message Queue Service
	public readonly messageQueueService: MessageQueueService
	messageQueueStateChangedHandler: (() => void) | undefined

	// Streaming
	isWaitingForFirstChunk = false
	isStreaming = false
	currentStreamingContentIndex = 0
	currentStreamingDidCheckpoint = false
	assistantMessageContent: AssistantMessageContent[] = []
	presentAssistantMessageLocked = false
	presentAssistantMessageHasPendingUpdates = false
	userMessageContent: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam | Anthropic.ToolResultBlockParam)[] = []
	userMessageContentReady = false

	/**
	 * Set to `true` after the assistant message is saved in `recursivelyMakeClineRequests`.
	 */
	assistantMessageSavedToHistory = false

	/**
	 * Flag indicating whether the assistant message for the current streaming session
	 * has been saved to API conversation history.
	 *
	 * This is critical for parallel tool calling: tools should NOT execute until
	 * the assistant message is saved. Otherwise, if a tool like `new_task` triggers
	 * `flushPendingToolResultsToHistory()`, the user message with tool_results would
	 * appear BEFORE the assistant message with tool_uses, causing API errors.
	 */
	public pushToolResultToUserContent(toolResult: Anthropic.ToolResultBlockParam): boolean {
		return pushToolResultToUserContentFromUtils(this, toolResult)
	}
	didRejectTool = false
	didAlreadyUseTool = false
	didToolFailInCurrentTurn = false
	didCompleteReadingStream = false
	_started = false
	// No streaming parser is required.
	assistantMessageParser?: undefined
	providerProfileChangeListener?: (config: { name: string; provider?: string }) => void

	// Native tool call streaming state (track which index each tool is at)
	streamingToolCallIndices: Map<string, number> = new Map()

	// Cached model info for current streaming session (set at start of each API request)
	// This prevents excessive getModel() calls during tool execution
	cachedStreamingModel?: { id: string; info: ModelInfo }

	// Token Usage Cache
	private tokenUsageSnapshot?: TokenUsage
	private tokenUsageSnapshotAt?: number

	// Tool Usage Cache
	private toolUsageSnapshot?: ToolUsage

	// Token Usage Throttling - Debounced emit function
	private readonly TOKEN_USAGE_EMIT_INTERVAL_MS = 2000 // 2 seconds
	debouncedEmitTokenUsage: ReturnType<typeof debounce>

	// Cloud Sync Tracking
	cloudSyncedMessageTimestamps: Set<number> = new Set()

	// Initial status for the task's history item (set at creation time to avoid race conditions)
	readonly initialStatus?: "active" | "delegated" | "completed"

	// MessageManager for high-level message operations (lazy initialized)
	private _messageManager?: MessageManager

	constructor({
		provider,
		apiConfiguration,
		enableCheckpoints = true,
		checkpointTimeout = DEFAULT_CHECKPOINT_TIMEOUT_SECONDS,
		consecutiveMistakeLimit = DEFAULT_CONSECUTIVE_MISTAKE_LIMIT,
		taskId,
		task,
		images,
		historyItem,
		experiments: experimentsConfig,
		startTask = true,
		rootTask,
		parentTask,
		taskNumber = -1,
		onCreated,
		initialTodos,
		workspacePath,
		initialStatus,
		mode,
	}: TaskOptions) {
		super()

		// Debug: clear log file and timestamp
		try {
			fs.writeFileSync("/tmp/task-debug.log", `=== Task constructor started at ${new Date().toISOString()} ===\n`)
		} catch (e) {
			/* ignore */
		}

		if (startTask && !task && !images && !historyItem) {
			throw new Error("Either historyItem or task/images must be provided")
		}

		if (
			!checkpointTimeout ||
			checkpointTimeout > MAX_CHECKPOINT_TIMEOUT_SECONDS ||
			checkpointTimeout < MIN_CHECKPOINT_TIMEOUT_SECONDS
		) {
			throw new Error(
				"checkpointTimeout must be between " +
					MIN_CHECKPOINT_TIMEOUT_SECONDS +
					" and " +
					MAX_CHECKPOINT_TIMEOUT_SECONDS +
					" seconds",
			)
		}

		this.taskId = historyItem ? historyItem.id : (taskId ?? uuidv7())
		this.rootTaskId = historyItem ? historyItem.rootTaskId : rootTask?.taskId
		this.parentTaskId = historyItem ? historyItem.parentTaskId : parentTask?.taskId
		this.childTaskId = undefined

		this.metadata = {
			task: historyItem ? historyItem.task : task,
			images: historyItem ? [] : images,
		}

		// Normal use-case is usually retry similar history task with new workspace.
		this.workspacePath = parentTask
			? parentTask.workspacePath
			: (workspacePath ?? getWorkspacePath(path.join(os.homedir(), "Desktop")))

		this.instanceId = crypto.randomUUID().slice(0, 8)
		this.taskNumber = -1
		this.virtualWorkspace = new VirtualWorkspace()

		this.jabberwockIgnoreController = new JabberwockIgnoreController(this.cwd)
		this.jabberwockProtectedController = new JabberwockProtectedController(this.cwd)
		this.fileContextTracker = new FileContextTracker(provider, this.taskId)

		this.jabberwockIgnoreController.initialize().catch((error) => {
			console.error("Failed to initialize JabberwockIgnoreController:", error)
		})

		this.apiConfiguration = apiConfiguration
		this.api = buildApiHandler(this.apiConfiguration)
		this.autoApprovalHandler = new AutoApprovalHandler()

		this.consecutiveMistakeLimit = consecutiveMistakeLimit ?? DEFAULT_CONSECUTIVE_MISTAKE_LIMIT
		this.providerRef = new WeakRef(provider)
		this.globalStoragePath = provider.context.globalStorageUri.fsPath
		this.diffViewProvider = new DiffViewProvider(this.cwd, this)
		this.enableCheckpoints = enableCheckpoints
		this.checkpointTimeout = checkpointTimeout

		this.parentTask = parentTask
		this.taskNumber = taskNumber
		this.initialStatus = initialStatus

		// Store the task's mode and API config name when it's created.
		// For history items, use the stored values; for new tasks, we'll set them
		// after getting state.
		if (historyItem) {
			this._taskMode = historyItem.mode || defaultModeSlug
			this._taskApiConfigName = historyItem.apiConfigName
			this.taskModeReady = Promise.resolve()
			this.taskApiConfigReady = Promise.resolve()
			getTelemetryService().captureTaskRestarted(this.taskId)
		} else {
			// For new tasks, don't set the mode/apiConfigName yet - wait for async initialization.
			this._taskMode = undefined
			this._taskApiConfigName = undefined
			this.taskModeReady = this.initializeTaskMode(provider, mode)
			this.taskApiConfigReady = this.initializeTaskApiConfigName(provider)
			getTelemetryService().captureTaskCreated(this.taskId)
		}

		this.assistantMessageParser = undefined

		this.messageQueueService = new MessageQueueService()

		this.messageQueueStateChangedHandler = () => {
			this.emit(JabberwockEventName.TaskUserMessage, this.taskId)
			this.emit(JabberwockEventName.QueuedMessagesUpdated, this.taskId, this.messageQueueService.messages)
			postStateToWebviewWithoutTaskHistory(this.providerRef.deref()!)
		}

		this.messageQueueService.on("stateChanged", this.messageQueueStateChangedHandler)

		// Listen for provider profile changes to update parser state
		this.setupProviderProfileChangeListener(provider)

		// Set up diff strategy
		this.diffStrategy = new MultiSearchReplaceDiffStrategy()

		this.toolRepetitionDetector = new ToolRepetitionDetector(this.consecutiveMistakeLimit)

		// Initialize todo list if provided
		if (initialTodos && initialTodos.length > 0) {
			this.todoList = initialTodos
			// [TODO-LOG] Todo list initialized from constructor
			const todoInitMsg = `[TODO-LOG] [Task] Todo list initialized (taskId: ${this.taskId}, count: ${initialTodos.length})`
			console.log(todoInitMsg)
			diagnosticsManager.log(todoInitMsg, "info")
		}

		// Initialize debounced token usage emit function
		// Uses debounce with maxWait to achieve throttle-like behavior:
		// - leading: true  - Emit immediately on first call
		// - trailing: true - Emit final state when updates stop
		// - maxWait        - Ensures at most one emit per interval during rapid updates (throttle behavior)
		this.debouncedEmitTokenUsage = debounce(
			(tokenUsage: TokenUsage, toolUsage: ToolUsage) => {
				const tokenChanged = hasTokenUsageChanged(tokenUsage, this.tokenUsageSnapshot)
				const toolChanged = hasToolUsageChanged(toolUsage, this.toolUsageSnapshot)

				if (tokenChanged || toolChanged) {
					this.emit(JabberwockEventName.TaskTokenUsageUpdated, this.taskId, tokenUsage, toolUsage)
					this.tokenUsageSnapshot = tokenUsage
					this.tokenUsageSnapshotAt = this.clineMessages.at(-1)?.ts
					// Deep copy tool usage for snapshot
					this.toolUsageSnapshot = JSON.parse(JSON.stringify(toolUsage))
				}
			},
			this.TOKEN_USAGE_EMIT_INTERVAL_MS,
			{ leading: true, trailing: true, maxWait: this.TOKEN_USAGE_EMIT_INTERVAL_MS },
		)

		onCreated?.(this)

		// Phase 4: Initialize TaskNode in ChatStore
		const providerInstance = this.providerRef.deref()
		const logMsg1 = `[Task:constructor] ChatStore block: providerInstance=${!!providerInstance}, hasChatStore=${!!(providerInstance && (providerInstance as { chatStore: ChatStoreType }).chatStore)}, taskId=${this.taskId}`
		console.log(logMsg1)
		try {
			fs.appendFileSync("/tmp/task-debug.log", logMsg1 + "\n")
		} catch (e) {
			/* ignore */
		}
		if (providerInstance && (providerInstance as { chatStore: ChatStoreType }).chatStore) {
			const store = (providerInstance as { chatStore: ChatStoreType }).chatStore
			const logMsg2 = `[Task:constructor] ChatStore block ENTERED: nodes.has(${this.taskId})=${store.nodes.has(this.taskId)}, nodes.size=${Array.from(store.nodes.keys()).length}`
			console.log(logMsg2)
			try {
				fs.appendFileSync("/tmp/task-debug.log", logMsg2 + "\n")
			} catch (e) {
				/* ignore */
			}
			if (!store.nodes.has(this.taskId)) {
				const logMsg3 = `[Task:constructor] Calling createBranch(parentId="${this.parentTaskId || ""}", title="${this.metadata.task || "New Task"}", id="${this.taskId}")`
				console.log(logMsg3)
				try {
					fs.appendFileSync("/tmp/task-debug.log", logMsg3 + "\n")
				} catch (e) {
					/* ignore */
				}
				store.createBranch(this.parentTaskId || "", this.metadata.task || "New Task", this.taskId)
				const logMsg4 = `[Task:constructor] After createBranch: nodes.size=${Array.from(store.nodes.keys()).length}, has(${this.taskId})=${store.nodes.has(this.taskId)}`
				console.log(logMsg4)
				try {
					fs.appendFileSync("/tmp/task-debug.log", logMsg4 + "\n")
				} catch (e) {
					/* ignore */
				}
				// Set initial mode for the node
				const node = store.nodes.get(this.taskId)
				if (node) {
					void this.getTaskMode().then((m) => {
						node.setMode(m)
					})
				}
			}
			// Always switch context to the current task's node when it becomes active
			const logMsg5 = `[Task:constructor] Calling switchContext(taskId=${this.taskId})`
			console.log(logMsg5)
			try {
				fs.appendFileSync("/tmp/task-debug.log", logMsg5 + "\n")
			} catch (e) {
				/* ignore */
			}
			store.switchContext(this.taskId)
			const logMsg6 = `[Task:constructor] After switchContext: activeNodeId=${store.activeNodeId ? store.activeNodeId.id : "null"}`
			console.log(logMsg6)
			try {
				fs.appendFileSync("/tmp/task-debug.log", logMsg6 + "\n")
			} catch (e) {
				/* ignore */
			}
		} else {
			const logMsg7 = `[Task:constructor] ChatStore block SKIPPED: providerInstance=${!!providerInstance}`
			console.log(logMsg7)
			try {
				fs.appendFileSync("/tmp/task-debug.log", logMsg7 + "\n")
			} catch (e) {
				/* ignore */
			}
		}

		if (startTask) {
			this._started = true
			if (task || images) {
				this.startTask(task, images)
			} else if (historyItem) {
				this.resumeTaskFromHistory()
			} else {
				throw new Error("Either historyItem or task/images must be provided")
			}
		}
	}

	async commitChanges(): Promise<void> {
		await this.virtualWorkspace.commitToDisk(this.cwd)
	}

	async rollbackChanges(): Promise<void> {
		this.virtualWorkspace.rollback()
	}

	/**
	 * Initialize the task mode from the provider state.
	 * This method handles async initialization with proper error handling.
	 *
	 * ## Flow
	 * 1. Attempts to fetch the current mode from provider state
	 * 2. Sets `_taskMode` to the fetched mode or `defaultModeSlug` if unavailable
	 * 3. Handles errors gracefully by falling back to default mode
	 * 4. Logs any initialization errors for debugging
	 *
	 * ## Error handling
	 * - Network failures when fetching provider state
	 * - Provider not yet initialized
	 * - Invalid state structure
	 *
	 * All errors result in fallback to `defaultModeSlug` to ensure task can proceed.
	 *
	 * @private
	 * @param provider - The EventBridge instance to fetch state from
	 * @returns Promise that resolves when initialization is complete
	 */
	private async initializeTaskMode(provider: EventBridge, explicitMode?: string): Promise<void> {
		try {
			if (explicitMode) {
				this._taskMode = explicitMode
				return
			}
			const state = await provider.getState()
			this._taskMode = state?.mode || defaultModeSlug
		} catch (error) {
			// If there's an error getting state, use the default mode
			this._taskMode = defaultModeSlug
			// Use the provider's log method for better error visibility
			const errorMessage = `Failed to initialize task mode: ${error instanceof Error ? error.message : String(error)}`
			provider.log(errorMessage)
		}
	}

	/**
	 * Initialize the task API config name from the provider state.
	 * This method handles async initialization with proper error handling.
	 *
	 * ## Flow
	 * 1. Attempts to fetch the current API config name from provider state
	 * 2. Sets `_taskApiConfigName` to the fetched name or "default" if unavailable
	 * 3. Handles errors gracefully by falling back to "default"
	 * 4. Logs any initialization errors for debugging
	 *
	 * ## Error handling
	 * - Network failures when fetching provider state
	 * - Provider not yet initialized
	 * - Invalid state structure
	 *
	 * All errors result in fallback to "default" to ensure task can proceed.
	 *
	 * @private
	 * @param provider - The EventBridge instance to fetch state from
	 * @returns Promise that resolves when initialization is complete
	 */
	private async initializeTaskApiConfigName(provider: EventBridge): Promise<void> {
		try {
			const state = await provider.getState()

			// Avoid clobbering a newer value that may have been set while awaiting provider state
			// (e.g., user switches provider profile immediately after task creation).
			if (this._taskApiConfigName === undefined) {
				this._taskApiConfigName = state?.currentApiConfigName ?? "default"
			}
		} catch (error) {
			// If there's an error getting state, use the default profile (unless a newer value was set).
			if (this._taskApiConfigName === undefined) {
				this._taskApiConfigName = "default"
			}
			// Use the provider's log method for better error visibility
			const errorMessage = `Failed to initialize task API config name: ${error instanceof Error ? error.message : String(error)}`
			provider.log(errorMessage)
		}
	}

	/**
	 * Sets up a listener for provider profile changes.
	 *
	 * @private
	 * @param provider - The EventBridge instance to listen to
	 */
	private setupProviderProfileChangeListener(provider: EventBridge): void {
		// Only set up listener if provider has the on method (may not exist in test mocks)
		if (typeof provider.on !== "function") {
			return
		}

		this.providerProfileChangeListener = async () => {
			try {
				const newState = await provider.getState()
				if (newState?.apiConfiguration) {
					this.updateApiConfiguration(newState.apiConfiguration)
				}
			} catch (error) {
				console.error(
					`[Task#${this.taskId}.${this.instanceId}] Failed to update API configuration on profile change:`,
					error,
				)
			}
		}

		provider.on(JabberwockEventName.ProviderProfileChanged, this.providerProfileChangeListener)
	}

	/**
	 * Public setter for the current task mode.
	 * Used by the provider when switching modes.
	 */
	public setTaskMode(mode: string) {
		this._taskMode = mode
	}

	/**
	 * Wait for the task mode to be initialized before proceeding.
	 * This method ensures that any operations depending on the task mode
	 * will have access to the correct mode value.
	 *
	 * ## When to use
	 * - Before accessing mode-specific configurations
	 * - When switching between tasks with different modes
	 * - Before operations that depend on mode-based permissions
	 *
	 * ## Example usage
	 * ```typescript
	 * // Wait for mode initialization before mode-dependent operations
	 * await task.waitForModeInitialization();
	 * const mode = task.taskMode; // Now safe to access synchronously
	 *
	 * // Or use with getTaskMode() for a one-liner
	 * const mode = await task.getTaskMode(); // Internally waits for initialization
	 * ```
	 *
	 * @returns Promise that resolves when the task mode is initialized
	 * @public
	 */
	public async waitForModeInitialization(): Promise<void> {
		return this.taskModeReady
	}

	/**
	 * Get the task mode asynchronously, ensuring it's properly initialized.
	 * This is the recommended way to access the task mode as it guarantees
	 * the mode is available before returning.
	 *
	 * ## Async behavior
	 * - Internally waits for `taskModeReady` promise to resolve
	 * - Returns the initialized mode or `defaultModeSlug` as fallback
	 * - Safe to call multiple times - subsequent calls return immediately if already initialized
	 *
	 * ## Example usage
	 * ```typescript
	 * // Safe async access
	 * const mode = await task.getTaskMode();
	 * console.log(`Task is running in ${mode} mode`);
	 *
	 * // Use in conditional logic
	 * if (await task.getTaskMode() === 'architect') {
	 *   // Perform architect-specific operations
	 * }
	 * ```
	 *
	 * @returns Promise resolving to the task mode string
	 * @public
	 */
	public async getTaskMode(): Promise<string> {
		await this.taskModeReady
		return this._taskMode || defaultModeSlug
	}

	/**
	 * Get the task mode synchronously. This should only be used when you're certain
	 * that the mode has already been initialized (e.g., after waitForModeInitialization).
	 *
	 * ## When to use
	 * - In synchronous contexts where async/await is not available
	 * - After explicitly waiting for initialization via `waitForModeInitialization()`
	 * - In event handlers or callbacks where mode is guaranteed to be initialized
	 *
	 * ## Example usage
	 * ```typescript
	 * // After ensuring initialization
	 * await task.waitForModeInitialization();
	 * const mode = task.taskMode; // Safe synchronous access
	 *
	 * // In an event handler after task is started
	 * task.on('taskStarted', () => {
	 *   console.log(`Task started in ${task.taskMode} mode`); // Safe here
	 * });
	 * ```
	 *
	 * @throws {Error} If the mode hasn't been initialized yet
	 * @returns The task mode string
	 * @public
	 */
	public get taskMode(): string {
		if (this._taskMode === undefined) {
			throw new Error("Task mode accessed before initialization. Use getTaskMode() or wait for taskModeReady.")
		}

		return this._taskMode
	}

	/**
	 * Wait for the task API config name to be initialized before proceeding.
	 * This method ensures that any operations depending on the task's provider profile
	 * will have access to the correct value.
	 *
	 * ## When to use
	 * - Before accessing provider profile-specific configurations
	 * - When switching between tasks with different provider profiles
	 * - Before operations that depend on the provider profile
	 *
	 * @returns Promise that resolves when the task API config name is initialized
	 * @public
	 */
	public async waitForApiConfigInitialization(): Promise<void> {
		return this.taskApiConfigReady
	}

	/**
	 * Get the task API config name asynchronously, ensuring it's properly initialized.
	 * This is the recommended way to access the task's provider profile as it guarantees
	 * the value is available before returning.
	 *
	 * ## Async behavior
	 * - Internally waits for `taskApiConfigReady` promise to resolve
	 * - Returns the initialized API config name or undefined as fallback
	 * - Safe to call multiple times - subsequent calls return immediately if already initialized
	 *
	 * @returns Promise resolving to the task API config name string or undefined
	 * @public
	 */
	public async getTaskApiConfigName(): Promise<string | undefined> {
		await this.taskApiConfigReady
		return this._taskApiConfigName
	}

	/**
	 * Get the task API config name synchronously. This should only be used when you're certain
	 * that the value has already been initialized (e.g., after waitForApiConfigInitialization).
	 *
	 * ## When to use
	 * - In synchronous contexts where async/await is not available
	 * - After explicitly waiting for initialization via `waitForApiConfigInitialization()`
	 * - In event handlers or callbacks where API config name is guaranteed to be initialized
	 *
	 * Note: Unlike taskMode, this getter does not throw if uninitialized since the API config
	 * name can legitimately be undefined (backward compatibility with tasks created before
	 * this feature was added).
	 *
	 * @returns The task API config name string or undefined
	 * @public
	 */
	public get taskApiConfigName(): string | undefined {
		return this._taskApiConfigName
	}

	/**
	 * Update the task's API config name. This is called when the user switches
	 * provider profiles while a task is active, allowing the task to remember
	 * its new provider profile.
	 *
	 * @param apiConfigName - The new API config name to set
	 * @internal
	 */
	public setTaskApiConfigName(apiConfigName: string | undefined): void {
		this._taskApiConfigName = apiConfigName
	}

	static create(options: TaskOptions): [Task, Promise<void>] {
		const instance = new Task({ ...options, startTask: false })
		const { images, task, historyItem } = options
		let promise

		if (images || task) {
			promise = instance.startTask(task, images)
		} else if (historyItem) {
			promise = instance.resumeTaskFromHistory()
		} else {
			throw new Error("Either historyItem or task/images must be provided")
		}

		return [instance, promise]
	}

	// API Messages

	public async getSavedApiConversationHistory(): Promise<ApiMessage[]> {
		return readApiMessages({ taskId: this.taskId, globalStoragePath: this.globalStoragePath })
	}

	public async addToApiConversationHistory(message: Anthropic.MessageParam, reasoning?: string) {
		return addToApiConversationHistoryAction(this, message, reasoning)
	}

	// NOTE: We intentionally do NOT mutate stored messages to merge consecutive user turns.
	// For API requests, consecutive same-role messages are merged via mergeConsecutiveApiMessages()
	// so rewind/edit behavior can still reference original message boundaries.

	async overwriteApiConversationHistory(newHistory: ApiMessage[], syncToUi = true) {
		return overwriteApiConversationHistoryAction(this, newHistory, syncToUi)
	}

	/**
	 * Flush any pending tool results to the API conversation history.
	 */
	public async flushPendingToolResultsToHistory(): Promise<boolean> {
		return flushPendingToolResultsToHistoryFromUtils(this)
	}

	public async saveApiConversationHistory(): Promise<boolean> {
		return saveApiConversationHistoryAction(this)
	}

	/**
	 * Public wrapper to retry saving the API conversation history.
	 * Uses exponential backoff: up to 3 attempts with delays of 100 ms, 500 ms, 1500 ms.
	 * Used by delegation flow when flushPendingToolResultsToHistory reports failure.
	 */
	public async retrySaveApiConversationHistory(): Promise<boolean> {
		const delays = [100, 500, 1500]

		for (let attempt = 0; attempt < delays.length; attempt++) {
			await delay(delays[attempt])
			console.warn(
				`[Task#${this.taskId}] retrySaveApiConversationHistory: retry attempt ${attempt + 1}/${delays.length}`,
			)

			const success = await this.saveApiConversationHistory()

			if (success) {
				return true
			}
		}

		return false
	}

	// Cline Messages

	public async getSavedClineMessages(): Promise<ClineMessage[]> {
		return readTaskMessages({ taskId: this.taskId, globalStoragePath: this.globalStoragePath })
	}

	async addToClineMessages(message: ClineMessage) {
		return addToClineMessagesAction(this, message)
	}

	public async overwriteClineMessages(newMessages: ClineMessage[]) {
		return overwriteClineMessagesAction(this, newMessages)
	}

	public async updateClineMessage(message: ClineMessage) {
		return updateClineMessageAction(this, message)
	}

	public findMessageByTimestamp(ts: number): ClineMessage | undefined {
		return findMessageByTimestampAction(this, ts)
	}

	public async saveClineMessages(): Promise<boolean> {
		try {
			await saveTaskMessages({
				messages: structuredClone(this.clineMessages),
				taskId: this.taskId,
				globalStoragePath: this.globalStoragePath,
			})

			// Phase 4: Sync UI messages to MST
			const providerInstance = this.providerRef.deref()
			if (providerInstance && providerInstance.chatStore) {
				const node = providerInstance.chatStore.nodes.get(this.taskId)
				if (node) {
					// We freeze/clone because MobX needs isolated models from raw JS objects
					node.syncUiMessages(structuredClone(this.clineMessages))
				}
			}

			if (this._taskApiConfigName === undefined) {
				await this.taskApiConfigReady
			}

			const { historyItem, tokenUsage } = await taskMetadata({
				taskId: this.taskId,
				rootTaskId: this.rootTaskId,
				parentTaskId: this.parentTaskId,
				taskNumber: this.taskNumber,
				messages: this.clineMessages,
				globalStoragePath: this.globalStoragePath,
				workspace: this.cwd,
				mode: this._taskMode || defaultModeSlug, // Use the task's own mode, not the current provider mode.
				apiConfigName: this._taskApiConfigName, // Use the task's own provider profile, not the current provider profile.
				initialStatus: this.initialStatus,
			})

			// Emit token/tool usage updates using debounced function
			// The debounce with maxWait ensures:
			this.debouncedEmitTokenUsage(tokenUsage, this.toolUsage)

			return true
		} catch (error) {
			console.error("Failed to save cline messages:", error)
			return false
		}
	}

	public async ask(
		type: ClineAsk,
		text?: string,
		partial?: boolean,
		progressStatus?: ToolProgressStatus,
		isProtected?: boolean,
	): Promise<{ response: ClineAskResponse; text?: string; images?: string[] }> {
		return askFromUtils(this, type, text, partial, progressStatus, isProtected)
	}

	public handleWebviewAskResponse(askResponse: ClineAskResponse, text?: string, images?: string[]) {
		handleWebviewAskResponseFromUtils(this, askResponse, text, images)
	}

	public approveAsk({ text, images }: { text?: string; images?: string[] } = {}) {
		approveAskFromUtils(this, { text, images })
	}

	public denyAsk({ text, images }: { text?: string; images?: string[] } = {}) {
		denyAskFromUtils(this, { text, images })
	}

	public supersedePendingAsk(): void {
		supersedePendingAskFromUtils(this)
	}

	public cancelAutoApprovalTimeout(): void {
		cancelAutoApprovalTimeoutFromUtils(this)
	}

	/**
	 * Updates the API configuration and rebuilds the API handler.
	 * There is no tool-protocol switching or tool parser swapping.
	 *
	 * @param newApiConfiguration - The new API configuration to use
	 */
	public updateApiConfiguration(newApiConfiguration: ProviderSettings): void {
		// Update the configuration and rebuild the API handler
		this.apiConfiguration = newApiConfiguration
		this.api = buildApiHandler(this.apiConfiguration)
	}

	public async submitUserMessage(
		text: string,
		images?: string[],
		mode?: string,
		providerProfile?: string,
	): Promise<void> {
		return submitUserMessageAction(this, text, images, mode, providerProfile)
	}

	async handleTerminalOperation(terminalOperation: "continue" | "abort") {
		if (terminalOperation === "continue") {
			this.terminalProcess?.continue()
		} else if (terminalOperation === "abort") {
			this.terminalProcess?.abort()
		}
	}

	async getFilesReadByJabberwockSafely(context: string): Promise<string[] | undefined> {
		try {
			return await this.fileContextTracker.getFilesReadByJabberwock()
		} catch (error) {
			console.error(`[Task#${context}] Failed to get files read by Jabberwock:`, error)
			return undefined
		}
	}

	public async condenseContext(): Promise<void> {
		return condenseContextAction(this)
	}

	async say(
		type: ClineSay,
		text?: string,
		images?: string[],
		partial?: boolean,
		checkpoint?: Record<string, unknown>,
		progressStatus?: ToolProgressStatus,
		options: {
			isNonInteractive?: boolean
		} = {},
		contextCondense?: ContextCondense,
		contextTruncation?: ContextTruncation,
	): Promise<undefined> {
		return sayFromUtils(
			this,
			type,
			text,
			images,
			partial,
			checkpoint,
			progressStatus,
			options,
			contextCondense,
			contextTruncation,
		)
	}

	async sayAndCreateMissingParamError(toolName: ToolName, paramName: string, relPath?: string): Promise<string> {
		return sayAndCreateMissingParamErrorFromUtils(this, toolName, paramName, relPath)
	}

	async getEnabledMcpToolsCount(): Promise<{ enabledToolCount: number; enabledServerCount: number }> {
		return getEnabledMcpToolsCountFromUtils(this)
	}

	public start(): void {
		startTaskAction(this)
	}

	// UI Elicitation Support
	pendingElicitationResolve?: (data: Record<string, unknown>) => void

	setupMcpHubListeners(mcpHub: McpHub) {
		// Delegate to utils; no-op now since mcpIntegration.ts handles it
	}

	public resolveElicitation(data: Record<string, unknown>) {
		resolveElicitationFromUtils(this, data)
	}

	private async startTask(task?: string, images?: string[]): Promise<void> {
		return startTaskAction(this)
	}

	async resumeTaskFromHistory() {
		return resumeTaskFromHistoryAction(this)
	}

	/**
	 * Cancels the current HTTP request if one is in progress.
	 * This immediately aborts the underlying stream rather than waiting for the next chunk.
	 */
	public cancelCurrentRequest(): void {
		if (this.currentRequestAbortController) {
			console.log(`[Task#${this.taskId}.${this.instanceId}] Aborting current HTTP request`)
			this.currentRequestAbortController.abort()
			this.currentRequestAbortController = undefined
		}
	}

	/**
	 * Force emit a final token usage update, ignoring throttle.
	 * Called before task completion or abort to ensure final stats are captured.
	 * Triggers the debounce with current values and immediately flushes to ensure emit.
	 */
	public emitFinalTokenUsageUpdate(): void {
		const tokenUsage = this.getTokenUsage()
		this.debouncedEmitTokenUsage(tokenUsage, this.toolUsage)
		this.debouncedEmitTokenUsage.flush()
	}

	public async abortTask(isAbandoned = false): Promise<void> {
		return abortTaskAction(this, isAbandoned)
	}

	public dispose(): void {
		disposeAction(this)
	}

	// Subtasks
	// Spawn / Wait / Complete

	public async startSubtask(message: string, initialTodos: TodoItem[], mode: string) {
		return startSubtaskAction(this, message, initialTodos, mode)
	}

	/**
	 * Resume parent task after delegation completion without showing resume ask.
	 * Used in metadata-driven subtask flow.
	 *
	 * This method:
	 * - Clears any pending ask states
	 * - Resets abort and streaming flags
	 * - Ensures next API call includes full context
	 * - Immediately continues task loop without user interaction
	 */
	public async resumeAfterDelegation(): Promise<void> {
		return resumeAfterDelegationAction(this)
	}

	// Task Loop

	async initiateTaskLoop(userContent: Anthropic.Messages.ContentBlockParam[]): Promise<void> {
		this.turnResetPending = false
		// Kicks off the checkpoints initialization process in the background.
		getCheckpointService(this)

		let nextUserContent = userContent
		let includeFileDetails = true

		this.emit(JabberwockEventName.TaskStarted)
		diagnosticsManager.recordTaskStart(
			this.taskId,
			"primary",
			userContent.map((c) => ("text" in c ? c.text : "[Media]")).join("\n"),
		)

		while (!this.abort) {
			const didEndLoop = await this.recursivelyMakeClineRequests(nextUserContent, includeFileDetails)
			includeFileDetails = false // We only need file details the first time.

			// The way this agentic loop works is that cline will be given a
			// task that he then calls tools to complete. Unless there's an
			// attempt_completion call, we keep responding back to him with his
			// tool's responses until he either attempt_completion or does not
			// use anymore tools. If he does not use anymore tools, we ask him
			// to consider if he's completed the task and then call
			// attempt_completion, otherwise proceed with completing the task.
			// There is a MAX_REQUESTS_PER_TASK limit to prevent infinite
			// requests, but Cline is prompted to finish the task as efficiently
			// as he can.

			if (didEndLoop) {
				// For now a task never 'completes'. This will only happen if
				// the user hits max requests and denies resetting the count.
				break
			} else {
				nextUserContent = [{ type: "text", text: formatResponse.noToolsUsed() }]
			}
		}
		diagnosticsManager.recordTaskEnd(this.taskId, this.abort ? "aborted" : "completed")
	}

	public async recursivelyMakeClineRequests(
		userContent: Anthropic.Messages.ContentBlockParam[],
		includeFileDetails: boolean = false,
	): Promise<boolean> {
		return runMainLoop(this, userContent, includeFileDetails)
	}

	async getSystemPrompt(): Promise<string> {
		return getSystemPromptAction(this)
	}

	private async handleContextWindowExceededError(): Promise<void> {
		return handleContextWindowExceededErrorAction(this)
	}

	public async *attemptApiRequest(
		retryAttempt: number = 0,
		options: { skipProviderRateLimit?: boolean } = {},
	): ApiStream {
		return yield* attemptApiRequestAction(this, retryAttempt, options)
	}

	// Shared exponential backoff for retries (first-chunk and mid-stream)
	public async backoffAndAnnounce(retryAttempt: number, error: unknown): Promise<void> {
		return backoffAndAnnounceAction(
			this,
			retryAttempt,
			error as { status?: number; message?: string; errorDetails?: Record<string, unknown>[] },
		)
	}

	public async maybeWaitForProviderRateLimit(retryAttempt: number): Promise<void> {
		return maybeWaitForProviderRateLimitAction(this, retryAttempt)
	}

	// Checkpoints

	public async checkpointSave(force: boolean = false, suppressMessage: boolean = false) {
		return checkpointSave(this, force, suppressMessage)
	}

	private buildCleanConversationHistory(messages: ApiMessage[]): Array<
		| Anthropic.Messages.MessageParam
		| {
				type: "reasoning"
				encrypted_content: string
				id?: string
				summary?: Anthropic.Messages.ContentBlockParam[]
		  }
	> {
		return buildCleanConversationHistoryAction(this, messages)
	}
	public async checkpointRestore(options: CheckpointRestoreOptions) {
		return checkpointRestore(this, options)
	}

	public async checkpointDiff(options: CheckpointDiffOptions) {
		return checkpointDiff(this, options)
	}

	public getTokenUsage(): TokenUsage {
		return getTokenUsageFromUtils(this)
	}

	public recordToolUsage(toolName: ToolName) {
		recordToolUsageFromUtils(this, toolName)
	}

	public recordToolError(toolName: ToolName, error?: string) {
		recordToolErrorFromUtils(this, toolName, error)
	}

	public get taskStatus(): TaskStatus {
		return getTaskStatusFromUtils(this)
	}

	public get tokenUsage(): TokenUsage | undefined {
		if (this.tokenUsageSnapshot && this.tokenUsageSnapshotAt) {
			return this.tokenUsageSnapshot
		}

		this.tokenUsageSnapshot = getTokenUsageFromUtils(this)
		this.tokenUsageSnapshotAt = this.clineMessages.at(-1)?.ts

		return this.tokenUsageSnapshot
	}

	public get cwd() {
		return this.workspacePath
	}

	// Metrics

	public combineMessages(messages: ClineMessage[]) {
		return combineApiRequests(combineCommandSequences(messages))
	}

	/**
	 * Provides convenient access to high-level message operations.
	 * Uses lazy initialization - the MessageManager is only created when first accessed.
	 * Subsequent accesses return the same cached instance.
	 *
	 * ## Important: Single Coordination Point
	 *
	 * **All MessageManager operations must go through this getter** rather than
	 * instantiating `new MessageManager(task)` directly. This ensures:
	 * - A single shared instance for consistent behavior
	 * - Centralized coordination of all rewind/message operations
	 * - Ability to add internal state or instrumentation in the future
	 *
	 * @example
	 * ```typescript
	 * // Correct: Use the getter
	 * await task.messageManager.rewindToTimestamp(ts)
	 *
	 * // Incorrect: Do NOT create new instances directly
	 * // const manager = new MessageManager(task) // Don't do this!
	 * ```
	 */
	get messageManager(): MessageManager {
		if (!this._messageManager) {
			this._messageManager = new MessageManager(this)
		}
		return this._messageManager
	}

	/**
	 * Process any queued messages by dequeuing and submitting them.
	 * This ensures that queued user messages are sent when appropriate,
	 * preventing them from getting stuck in the queue.
	 *
	 * @param context - Context string for logging (e.g., the calling tool name)
	 */
	public processQueuedMessages(): void {
		return processQueuedMessagesAction(this)
	}

	public get taskAsk(): ClineMessage | undefined {
		return this.idleAsk || this.resumableAsk || this.interactiveAsk
	}

	public get queuedMessages(): QueuedMessage[] {
		return this.messageQueueService.messages
	}
}
