import type { ApiHandler } from "@api/index"
import type { RepoPerTaskCheckpointService } from "@services/checkpoints"
import type { Anthropic } from "@anthropic-ai/sdk"
import type { AskResponseValue, TokenUsage, ToolUsage, Notification } from "@jabberwock/types"
import type { AssistantMessageContent } from "@features/chat/task/messages/actions"
import type { ApiMessage } from "@features/chat/task/messages/actions/save/saveApiMessages.types"
import type { JabberwockTerminalProcessResultPromise } from "@integrations/terminal/types"
import type { IAutoApprovalHandler } from "@features/settings"
import debounce from "lodash.debounce"

export function createTaskVolatileState() {
	return {
		// Core runtime deps
		api: undefined as ApiHandler | undefined,
		abortController: undefined as AbortController | undefined,
		jabberwockIgnoreController: undefined as string | undefined,

		// Time-machine (checkpoint service)
		checkpointService: undefined as RepoPerTaskCheckpointService | undefined,
		messageManager: undefined as
			| {
					rewindToTimestamp: (ts: number, options: { includeTargetMessage: boolean }) => Promise<void>
			  }
			| undefined,

		// Task runtime state (migrated from legacy Task class)
		diffStrategy: undefined as import("@shared/tools").DiffStrategy | undefined,
		globalStoragePath: "",
		lastUsedTs: 0,
		lastApiRequestTime: 0 as number | undefined,
		tokenUsageSnapshot: undefined as TokenUsage | undefined,
		tokenUsageSnapshotAt: undefined as number | undefined,
		toolUsageSnapshot: undefined as ToolUsage | undefined,
		userMessageContent: [] as (
			| Anthropic.TextBlockParam
			| Anthropic.ImageBlockParam
			| Anthropic.ToolResultBlockParam
		)[],
		assistantMessageContent: [] as AssistantMessageContent[],
		messages: [] as Notification[],
		apiConversationHistory: [] as ApiMessage[],
		debouncedEmitTokenUsage: undefined as ReturnType<typeof debounce> | undefined,
		didEditFile: false,
		cachedStreamingModel: undefined as { id: string; info: { [key: string]: unknown } } | undefined,
		lastMessageTs: 0,

		// ── Synchronous partial message tracking ──────────────────────
		_partialMessage: undefined as { ts: number; say: string } | undefined,

		askShownAt: undefined as number | undefined,
		autoApprovalTimeoutRef: undefined as NodeJS.Timeout | undefined,
		cloudSyncedMessageTimestamps: undefined as Set<number> | undefined,
		currentRequestAbortController: undefined as AbortController | undefined,
		terminalProcess: undefined as JabberwockTerminalProcessResultPromise | undefined,

		// ── Promise-based initialization gates ──────────────────────
		taskModeReady: undefined as Promise<void> | undefined,
		taskApiConfigReady: undefined as Promise<void> | undefined,

		// ── Ask response resolver ──────────────────────────────────
		askResolve: undefined as
			| ((value: { response: AskResponseValue; text?: string; images?: string[] }) => void)
			| null
			| undefined,

		// ── Tool repetition detector ───────────────────────────────
		toolRepetitionDetector: undefined as
			| {
					check(block: unknown): {
						allowExecution: boolean
						askUser: { messageKey: string; messageDetail: string }
					}
					reset(): void
			  }
			| undefined,

		// ── Auto-approval handler ───────────────────────────────────
		autoApprovalHandler: undefined as IAutoApprovalHandler | undefined,

		// ── Method stubs (exist on Task class at runtime) ────────────
		getFilesReadByJabberwockSafely: undefined as ((context: string) => Promise<string[] | undefined>) | undefined,
		combineMessages: undefined as ((messages: Notification[]) => Notification[]) | undefined,
		emit: undefined as ((event: string, ...args: unknown[]) => void) | undefined,
		getSavedMessages: undefined as (() => Promise<Notification[]>) | undefined,
		getSavedApiConversationHistory: undefined as (() => Promise<unknown[]>) | undefined,
		saveApiConversationHistory: undefined as (() => Promise<void>) | undefined,
		attemptApiRequest: undefined as
			| ((retryAttempt: number, opts: { [key: string]: unknown }) => AsyncIterable<unknown>)
			| undefined,
	}
}
