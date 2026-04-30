import { Anthropic } from "@anthropic-ai/sdk"

import { type ClineAsk, type ClineApiReqInfo } from "@jabberwock/types"

import { type ApiMessage } from "../../../../task-persistence"

import { findLastIndex } from "../../../../../shared/array"
import { ClineAskResponse } from "../../../../../shared/WebviewMessage"
import { formatResponse } from "../../../../prompts/responses"
import { initiateTaskLoop } from "../actions/startTask"
import { overwriteClineMessages } from "./messagePersistence"
import { overwriteApiConversationHistory } from "../actions/overwriteApiHistory"
import { Task } from "../../../../task/Task"

/**
 * Resumes a task from saved history.
 * Cleans up cline messages, reconstructs API conversation history,
 * and prompts the user to resume or continue the task.
 */
export async function resumeTaskFromHistory(task: Task): Promise<void> {
	try {
		const modifiedClineMessages = await task.getSavedClineMessages()

		// Remove any resume messages that may have been added before.
		const lastRelevantMessageIndex = findLastIndex(
			modifiedClineMessages,
			(m: any) => !(m.ask === "resume_task" || m.ask === "resume_completed_task"),
		)

		if (lastRelevantMessageIndex !== -1) {
			modifiedClineMessages.splice(lastRelevantMessageIndex + 1)
		}

		// Remove any trailing reasoning-only UI messages that were not part of the persisted API conversation
		while (modifiedClineMessages.length > 0) {
			const last = modifiedClineMessages[modifiedClineMessages.length - 1]
			if (last.type === "say" && last.say === "reasoning") {
				modifiedClineMessages.pop()
			} else {
				break
			}
		}

		// Since we don't use `api_req_finished` anymore, we need to check if the
		// last `api_req_started` has a cost value, if it doesn't and no
		// cancellation reason to present, then we remove it since it indicates
		// an api request without any partial content streamed.
		const lastApiReqStartedIndex = findLastIndex(
			modifiedClineMessages,
			(m: any) => m.type === "say" && m.say === "api_req_started",
		)

		if (lastApiReqStartedIndex !== -1) {
			const lastApiReqStarted = modifiedClineMessages[lastApiReqStartedIndex]
			const { cost, cancelReason }: ClineApiReqInfo = JSON.parse(lastApiReqStarted.text || "{}")

			if (cost === undefined && cancelReason === undefined) {
				modifiedClineMessages.splice(lastApiReqStartedIndex, 1)
			}
		}

		await overwriteClineMessages(task, modifiedClineMessages)
		task.clineMessages = await task.getSavedClineMessages()

		// Now present the cline messages to the user and ask if they want to
		// resume (NOTE: we ran into a bug before where the
		// apiConversationHistory wouldn't be initialized when opening a old
		// task, and it was because we were waiting for resume).
		// This is important in case the user deletes messages without resuming
		// the task first.
		task.apiConversationHistory = await task.getSavedApiConversationHistory()

		const lastClineMessage = task.clineMessages
			.slice()
			.reverse()
			.find((m: any) => !(m.ask === "resume_task" || m.ask === "resume_completed_task")) // Could be multiple resume tasks.

		let askType: ClineAsk
		if (lastClineMessage?.ask === "completion_result") {
			askType = "resume_completed_task"
		} else {
			askType = "resume_task"
		}

		task.isInitialized = true

		const { response, text, images } = await task.ask(askType) // Calls `postStateToWebview`.

		let responseText: string | undefined
		let responseImages: string[] | undefined

		if (response === "messageResponse") {
			await task.say("user_feedback", text, images)
			responseText = text
			responseImages = images
		}

		// Make sure that the api conversation history can be resumed by the API,
		// even if it goes out of sync with cline messages.
		let existingApiConversationHistory: ApiMessage[] = await task.getSavedApiConversationHistory()

		// Tool blocks are always preserved; native tool calling only.

		// if the last message is an assistant message, we need to check if there's tool use since every tool use has to have a tool response
		// if there's no tool use and only a text block, then we can just add a user message
		// (note this isn't relevant anymore since we use custom tool prompts instead of tool use blocks, but this is here for legacy purposes in case users resume old tasks)

		// if the last message is a user message, we can need to get the assistant message before it to see if it made tool calls, and if so, fill in the remaining tool responses with 'interrupted'

		let modifiedOldUserContent: Anthropic.Messages.ContentBlockParam[] // either the last message if its user message, or the user message before the last (assistant) message
		let modifiedApiConversationHistory: ApiMessage[] // need to remove the last user message to replace with new modified user message
		if (existingApiConversationHistory.length > 0) {
			const lastMessage = existingApiConversationHistory[existingApiConversationHistory.length - 1]

			// Dispatch based on last message type: isSummary, assistant, or user
			type ResumeHandler = () => { history: ApiMessage[]; oldContent: Anthropic.Messages.ContentBlockParam[] }

			const resumeHandlers: Record<string, ResumeHandler> = {
				summary: () => ({
					// IMPORTANT: If the last message is a condensation summary, we must preserve it
					// intact. The summary message carries critical metadata (isSummary, condenseId)
					// that getEffectiveApiHistory() uses to filter out condensed messages.
					// Removing or merging it would destroy this metadata, causing all condensed
					// messages to become "orphaned" and restored to active status — effectively
					// undoing the condensation and sending the full history to the API.
					// See: https://github.com/JabberwockInc/Jabberwock/issues/11487
					history: [...existingApiConversationHistory],
					oldContent: [],
				}),
				assistant_with_tools: () => {
					const content = Array.isArray(lastMessage.content)
						? lastMessage.content
						: [{ type: "text" as const, text: lastMessage.content }]
					const toolUseBlocks = content.filter(
						(block) => block.type === "tool_use",
					) as Anthropic.Messages.ToolUseBlock[]
					const toolResponses: Anthropic.ToolResultBlockParam[] = toolUseBlocks.map((block) => ({
						type: "tool_result",
						tool_use_id: block.id,
						content: "Task was interrupted before this tool call could be completed.",
					}))
					return {
						history: [...existingApiConversationHistory],
						oldContent: [...toolResponses],
					}
				},
				assistant_no_tools: () => ({
					history: [...existingApiConversationHistory],
					oldContent: [],
				}),
				user_with_missing_tools: () => {
					const previousAssistantMessage: ApiMessage | undefined =
						existingApiConversationHistory[existingApiConversationHistory.length - 2]
					const existingUserContent: Anthropic.Messages.ContentBlockParam[] = Array.isArray(
						lastMessage.content,
					)
						? lastMessage.content
						: [{ type: "text" as const, text: lastMessage.content }]

					const assistantContent = Array.isArray(previousAssistantMessage!.content)
						? previousAssistantMessage!.content
						: [{ type: "text" as const, text: previousAssistantMessage!.content }]

					const toolUseBlocks = assistantContent.filter(
						(block) => block.type === "tool_use",
					) as Anthropic.Messages.ToolUseBlock[]

					const existingToolResults = existingUserContent.filter(
						(block) => block.type === "tool_result",
					) as Anthropic.ToolResultBlockParam[]

					const missingToolResponses: Anthropic.ToolResultBlockParam[] = toolUseBlocks
						.filter((toolUse) => !existingToolResults.some((result) => result.tool_use_id === toolUse.id))
						.map((toolUse) => ({
							type: "tool_result",
							tool_use_id: toolUse.id,
							content: "Task was interrupted before this tool call could be completed.",
						}))

					return {
						history: existingApiConversationHistory.slice(0, -1),
						oldContent: [...existingUserContent, ...missingToolResponses],
					}
				},
				user_no_tools: () => {
					const existingUserContent: Anthropic.Messages.ContentBlockParam[] = Array.isArray(
						lastMessage.content,
					)
						? lastMessage.content
						: [{ type: "text" as const, text: lastMessage.content }]
					return {
						history: existingApiConversationHistory.slice(0, -1),
						oldContent: [...existingUserContent],
					}
				},
			}

			// Determine the handler key based on last message type
			let handlerKey: string
			if ((lastMessage as any).isSummary) {
				handlerKey = "summary"
			} else if (lastMessage.role === "assistant") {
				const content = Array.isArray(lastMessage.content)
					? lastMessage.content
					: [{ type: "text" as const, text: lastMessage.content }]
				handlerKey = content.some((block) => block.type === "tool_use")
					? "assistant_with_tools"
					: "assistant_no_tools"
			} else if (lastMessage.role === "user") {
				const previousAssistantMessage: ApiMessage | undefined =
					existingApiConversationHistory[existingApiConversationHistory.length - 2]
				const hasPreviousAssistant = previousAssistantMessage && previousAssistantMessage.role === "assistant"

				if (hasPreviousAssistant) {
					const assistantContent = Array.isArray(previousAssistantMessage!.content)
						? previousAssistantMessage!.content
						: [{ type: "text" as const, text: previousAssistantMessage!.content }]
					handlerKey = assistantContent.some((block) => block.type === "tool_use")
						? "user_with_missing_tools"
						: "user_no_tools"
				} else {
					handlerKey = "user_no_tools"
				}
			} else {
				throw new Error("Unexpected: Last message is not a user or assistant message")
			}

			const handler = resumeHandlers[handlerKey]
			const result = handler()
			modifiedApiConversationHistory = result.history
			modifiedOldUserContent = result.oldContent
		} else {
			throw new Error("Unexpected: No existing API conversation history")
		}

		let newUserContent: Anthropic.Messages.ContentBlockParam[] = [...modifiedOldUserContent]

		const agoText = ((): string => {
			const timestamp = lastClineMessage?.ts ?? Date.now()
			const now = Date.now()
			const diff = now - timestamp
			const minutes = Math.floor(diff / 60000)
			const hours = Math.floor(minutes / 60)
			const days = Math.floor(hours / 24)

			if (days > 0) {
				return `${days} day${days > 1 ? "s" : ""} ago`
			}
			if (hours > 0) {
				return `${hours} hour${hours > 1 ? "s" : ""} ago`
			}
			if (minutes > 0) {
				return `${minutes} minute${minutes > 1 ? "s" : ""} ago`
			}
			return "just now"
		})()

		if (responseText) {
			newUserContent.push({
				type: "text",
				text: `<user_message>\n${responseText}\n</user_message>`,
			})
		}

		if (responseImages && responseImages.length > 0) {
			newUserContent.push(...formatResponse.imageBlocks(responseImages))
		}

		// Ensure we have at least some content to send to the API.
		// If newUserContent is empty, add a minimal resumption message.
		if (newUserContent.length === 0) {
			newUserContent.push({
				type: "text",
				text: "[TASK RESUMPTION] Resuming task...",
			})
		}

		await overwriteApiConversationHistory(task, modifiedApiConversationHistory)

		// Task resuming from history item.
		await initiateTaskLoop(task, newUserContent)
	} catch (error) {
		// Resume and cancellation can race when users issue repeated cancels.
		// Treat intentional abort/abandon flows as expected and avoid process-level crashes.
		if (task.abandoned === true || task.abort === true || task.abortReason === "user_cancelled") {
			return
		}
		throw error
	}
}
