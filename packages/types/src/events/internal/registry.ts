import { JabberwockEventName } from "../types.ts"
import type { Notification } from "../../messages/notification.ts"
import type { ChatMessage, QueuedMessage, TokenUsage } from "../../messages/types.ts"
import type { ToolUsage, ToolName } from "../../tool/tool.ts"
import type { ModelInfo } from "../../models/model.ts"
import type { Command } from "../../extension/state.ts"

export interface BackendInternalEvents {
	chat: {
		task: {
			[JabberwockEventName.TaskCreated]: { taskId: string }
			[JabberwockEventName.TaskStarted]: { taskId: string }
			[JabberwockEventName.TaskCompleted]: {
				taskId: string
				tokenUsage: TokenUsage
				toolUsage: ToolUsage
				isSubtask: boolean
			}
			[JabberwockEventName.TaskAborted]: { taskId: string }
			[JabberwockEventName.TaskFocused]: { taskId: string }
			[JabberwockEventName.TaskUnfocused]: { taskId: string }
			[JabberwockEventName.TaskActive]: { taskId: string }
			[JabberwockEventName.TaskInteractive]: { taskId: string }
			[JabberwockEventName.TaskResumable]: { taskId: string }
			[JabberwockEventName.TaskIdle]: { taskId: string }
			[JabberwockEventName.TaskPaused]: { taskId: string }
			[JabberwockEventName.TaskUnpaused]: { taskId: string }
			[JabberwockEventName.TaskSpawned]: { parentTaskId: string; childTaskId: string }
			[JabberwockEventName.TaskDelegated]: { parentTaskId: string; childTaskId: string }
			[JabberwockEventName.TaskDelegationCompleted]: {
				parentTaskId: string
				childTaskId: string
				completionResultSummary: string
			}
			[JabberwockEventName.TaskDelegationResumed]: { parentTaskId: string; childTaskId: string }
			[JabberwockEventName.Message]: {
				taskId: string
				action: "created" | "updated"
				message: Notification
				chatMessage?: ChatMessage
			}
			[JabberwockEventName.TaskModeSwitched]: { taskId: string; newMode: string }
			[JabberwockEventName.TaskAskResponded]: { taskId: string }
			[JabberwockEventName.TaskUserMessage]: { taskId: string }
			[JabberwockEventName.QueuedMessagesUpdated]: { taskId: string; queuedMessages: QueuedMessage[] }
			[JabberwockEventName.TaskTokenUsageUpdated]: {
				taskId: string
				tokenUsage: TokenUsage
				toolUsage: ToolUsage
			}
			[JabberwockEventName.TaskToolFailed]: { taskId: string; toolName: ToolName; error: string }
		}
	}
	diagnostics: {
		[JabberwockEventName.EvalPass]: { taskId: number }
		[JabberwockEventName.EvalFail]: { taskId: number }
	}
	foundation: {
		[JabberwockEventName.CommandsResponse]: { commands: Command[] }
		[JabberwockEventName.ModesResponse]: { modes: { slug: string; name: string }[] }
		[JabberwockEventName.ModelsResponse]: { models: Record<string, ModelInfo> }
	}
	settings: {
		[JabberwockEventName.ModeChanged]: { mode: string }
		[JabberwockEventName.ProviderProfileChanged]: { name: string; provider: string }
	}
}
