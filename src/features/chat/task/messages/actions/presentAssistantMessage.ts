import { serializeError } from "serialize-error"
import { Anthropic } from "@anthropic-ai/sdk"

import type { ToolName, NotificationAsk, ToolProgressStatus } from "@jabberwock/types"
import { ConsecutiveMistakeError, TelemetryEventName } from "@jabberwock/types"
import { TelemetryService, getTelemetryService, hasTelemetryService } from "@jabberwock/telemetry"
import { customToolRegistry } from "@jabberwock/core"

import { t } from "../../../../../i18n"

import { defaultModeSlug, getModeBySlug } from "../../../../../shared/modes"
import type { ModeConfig } from "@jabberwock/types"
import type { ToolParamName, ToolResponse, TextContent, ToolUse, McpToolUse } from "../../../../../shared/tools"

import { AskIgnoredError } from "../../notifications/actions/AskIgnoredError"
import type { ITaskModel } from "../../store"

import { listFilesTool } from "../../../tools/ListFilesTool"
import { readFileTool } from "../../../tools/ReadFileTool"
import { readCommandOutputTool } from "../../../tools/ReadCommandOutputTool"
import { writeToFileTool } from "../../../tools/WriteToFileTool"
import { editTool } from "../../../tools/EditTool"
import { searchReplaceTool } from "../../../tools/SearchReplaceTool"
import { editFileTool } from "../../../tools/EditFileTool"
import { applyPatchTool } from "../../../tools/ApplyPatchTool"
import { searchFilesTool } from "../../../tools/SearchFilesTool"
import { executeCommandTool } from "../../../tools/ExecuteCommandTool"
import { useMcpToolTool } from "../../../tools/UseMcpToolTool"
import { accessMcpResourceTool } from "../../../tools/accessMcpResourceTool"
import { askFollowupQuestionTool } from "../../../tools/AskFollowupQuestionTool"
import { switchModeTool } from "../../../tools/SwitchModeTool"
import { delegateParentAndOpenChild } from "../../actions/delegateTask"
import { attemptCompletionTool, AttemptCompletionCallbacks } from "../../../tools/AttemptCompletionTool"
import { delegateTaskTool } from "../../../tools/DelegateTaskTool"
import { awaitBatchCompletionTool } from "../../../tools/AwaitBatchCompletionTool"
import { newTaskTool } from "../../../tools/NewTaskTool"
import { updateTodoListTool } from "../../../tools/UpdateTodoListTool"
import { runSlashCommandTool } from "../../../tools/RunSlashCommandTool"
import { skillTool } from "../../../tools/SkillTool"
import { generateImageTool } from "../../../tools/GenerateImageTool"
import { applyDiffTool as applyDiffToolClass } from "../../../tools/ApplyDiffTool"
import { isValidToolName, validateToolUse } from "../../../tools/validateToolUse"
import { codebaseSearchTool } from "../../../tools/CodebaseSearchTool"
import { thinkTool } from "../../../tools/ThinkTool"

import { formatResponse } from "../../../../settings/context/responses"
import { sanitizeToolUseId } from "../../../../../utils/tool-id"
import { diagnosticsManager } from "@jabberwock/devtool"
import { agentStore } from "../../../../settings/agents/store"

/**
 * Processes and presents assistant message content to the user interface.
 *
 * This function is the core message handling system that:
 * - Sequentially processes content blocks from the assistant's response.
 * - Displays text content to the user.
 * - Executes tool use requests with appropriate user approval.
 * - Manages the flow of conversation by determining when to proceed to the next content block.
 * - Coordinates file system checkpointing for modified files.
 * - Controls the conversation state to determine when to continue to the next request.
 *
 * The function uses a locking mechanism to prevent concurrent execution and handles
 * partial content blocks during streaming. It's designed to work with the streaming
 * API response pattern, where content arrives incrementally and needs to be processed
 * as it becomes available.
 */

import type { AssistantMessageContent } from "./types"
import { ask } from "../../notifications/actions/ask"
import { agentBroadcast, userBroadcast, systemBroadcast } from "./say"

import { pushToolResultToUserContent } from "../../../../api/handlers/helpers/streaming"
import { checkpointSave } from "../../../../foundation/time-machine/actions/checkpoints"

import { getBackendRootStore } from "@features/storeSingleton"

import { getMcpServerManager } from "../../../../../services/mcp/McpServerManager"

/** Recursion depth counter for presentAssistantMessage to prevent infinite re-entry loops */
let presentAssistantMessageRecursionDepth = 0

export async function presentAssistantMessage(task: ITaskModel) {
	if (task._state.abort) {
		throw new Error(`[Task#presentAssistantMessage] task ${task.taskId}.${task.instanceId} aborted`)
	}

	// Recursion depth guard to prevent infinite re-entry loops
	if (presentAssistantMessageRecursionDepth > 10) {
		console.error(
			`[jabberwock] [presentAssistantMessage] Recursion depth exceeded (${presentAssistantMessageRecursionDepth}), aborting to prevent infinite loop`,
		)
		task._state.setPresentAssistantMessageLocked(false)
		return
	}
	presentAssistantMessageRecursionDepth++

	try {
		if (task._state.presentAssistantMessageLocked) {
			task._state.setPresentAssistantMessageHasPendingUpdates(true)
			return
		}

		task._state.setPresentAssistantMessageLocked(true)
		task._state.setPresentAssistantMessageHasPendingUpdates(false)

		if (task._state.currentStreamingContentIndex >= task.assistantMessageContent.length) {
			// This may happen if the last content block was completed before
			// streaming could finish. If streaming is finished, and we're out of
			// bounds then this means we already  presented/executed the last
			// content block and are ready to continue to next request.
			if (task._state.didCompleteReadingStream) {
				task._state.setUserMessageContentReady(true)
			}

			task._state.setPresentAssistantMessageLocked(false)
			return
		}

		let block: AssistantMessageContent
		try {
			// Performance optimization: Use shallow copy instead of deep clone.
			// The block is used read-only throughout this function - we never mutate its properties.
			// We only need to protect against the reference changing during streaming, not nested mutations.
			// This provides 80-90% reduction in cloning overhead (5-100ms saved per block).
			block = { ...task.assistantMessageContent[task._state.currentStreamingContentIndex] }
		} catch (error) {
			console.error(`[jabberwock] ERROR cloning block:`, error)
			console.error(
				`Block content:`,
				JSON.stringify(task.assistantMessageContent[task._state.currentStreamingContentIndex], null, 2),
			)
			task._state.setPresentAssistantMessageLocked(false)
			return
		}

		switch (block.type) {
			case "mcp_tool_use": {
				// Handle native MCP tool calls (from mcp_serverName_toolName dynamic tools)
				// These are converted to the same execution path as use_mcp_tool but preserve
				// their original name in API history
				const mcpBlock = block as McpToolUse

				if (task._state.didRejectTool) {
					// For native protocol, we must send a tool_result for every tool_use to avoid API errors
					const toolCallId = mcpBlock.id
					const errorMessage = !mcpBlock.partial
						? `Skipping MCP tool ${mcpBlock.name} due to user rejecting a previous tool.`
						: `MCP tool ${mcpBlock.name} was interrupted and not executed due to user rejecting a previous tool.`

					if (toolCallId) {
						pushToolResultToUserContent(task.userMessageContent, {
							type: "tool_result",
							tool_use_id: sanitizeToolUseId(toolCallId),
							content: errorMessage,
							is_error: true,
						})
					}
					break
				}

				// Track if we've already pushed a tool result
				let hasToolResult = false
				const toolCallId = mcpBlock.id

				// Store approval feedback to merge into tool result (GitHub #10465)
				let approvalFeedback: { text: string; images?: string[] } | undefined

				const pushToolResult = (content: ToolResponse, feedbackImages?: string[]) => {
					if (hasToolResult) {
						console.error(
							`[jabberwock] [presentAssistantMessage] Skipping duplicate tool_result for mcp_tool_use: ${toolCallId}`,
						)
						return
					}

					let resultContent: string
					let imageBlocks: Anthropic.ImageBlockParam[] = []

					if (typeof content === "string") {
						resultContent = content || "(tool did not return anything)"
					} else {
						const textBlocks = content.filter((item) => item.type === "text")
						imageBlocks = content.filter((item) => item.type === "image") as Anthropic.ImageBlockParam[]
						resultContent =
							textBlocks.map((item) => (item as Anthropic.TextBlockParam).text).join("\n") ||
							"(tool did not return anything)"
					}

					// Merge approval feedback into tool result (GitHub #10465)
					if (approvalFeedback) {
						const feedbackText = formatResponse.toolApprovedWithFeedback(approvalFeedback.text)
						resultContent = `${feedbackText}\n\n${resultContent}`

						// Add feedback images to the image blocks
						if (approvalFeedback.images) {
							const feedbackImageBlocks = formatResponse.imageBlocks(approvalFeedback.images)
							imageBlocks = [...feedbackImageBlocks, ...imageBlocks]
						}
					}

					if (toolCallId) {
						pushToolResultToUserContent(task.userMessageContent, {
							type: "tool_result",
							tool_use_id: sanitizeToolUseId(toolCallId),
							content: resultContent,
						})

						if (imageBlocks.length > 0) {
							task.userMessageContent.push(...imageBlocks)
						}
					}

					hasToolResult = true
				}

				const toolDescription = () => `[mcp_tool: ${mcpBlock.serverName}/${mcpBlock.toolName}]`

				const askApproval = async (
					type: NotificationAsk,
					partialMessage?: string,
					progressStatus?: ToolProgressStatus,
					isProtected?: boolean,
				) => {
					const { response, text, images } = await ask(
						task.taskId,
						type,
						partialMessage,
						false,
						progressStatus,
						isProtected || false,
					)

					if (response !== "yesButtonClicked") {
						if (text) {
							await userBroadcast(task.taskId, "user_feedback", text, images)
							pushToolResult(
								formatResponse.toolResult(formatResponse.toolDeniedWithFeedback(text), images),
							)
						} else {
							pushToolResult(formatResponse.toolDenied())
						}
						task._state.setDidRejectTool(true)
						return false
					}

					// Store approval feedback to be merged into tool result (GitHub #10465)
					// Don't push it as a separate tool_result here - that would create duplicates.
					// The tool will call pushToolResult, which will merge the feedback into the actual result.
					if (text) {
						await userBroadcast(task.taskId, "user_feedback", text, images)
						approvalFeedback = { text, images }
					}

					return true
				}

				const handleError = async (action: string, error: Error) => {
					// Silently ignore AskIgnoredError - this is an internal control flow
					// signal, not an actual error. It occurs when a newer ask supersedes an older one.
					if (error instanceof AskIgnoredError) {
						return
					}
					const errorString = `Error ${action}: ${JSON.stringify(serializeError(error))}`
					await systemBroadcast(
						task.taskId,
						"error",
						`Error ${action}:\n${error.message ?? JSON.stringify(serializeError(error), null, 2)}`,
					)
					pushToolResult(formatResponse.toolError(errorString))
				}

				if (!mcpBlock.partial) {
					task.recordToolUsage("use_mcp_tool") // Record as use_mcp_tool for analytics
					getTelemetryService().captureToolUsage(task.taskId, "use_mcp_tool")
				}

				// Resolve sanitized server name back to original server name
				// The serverName from parsing is sanitized (e.g., "my_server" from "my server")
				// We need the original name to find the actual MCP connection
				const mcpHub = getMcpServerManager()["_mcpHub"]
				let resolvedServerName = mcpBlock.serverName
				if (mcpHub) {
					const originalName = mcpHub.findServerNameBySanitizedName(mcpBlock.serverName)
					if (originalName) {
						resolvedServerName = originalName
					}
				}

				// Execute the MCP tool using the same handler as use_mcp_tool
				// Create a synthetic ToolUse block that the useMcpToolTool can handle
				const syntheticToolUse: ToolUse<"use_mcp_tool"> = {
					type: "tool_use",
					id: mcpBlock.id,
					name: "use_mcp_tool",
					params: {
						server_name: resolvedServerName,
						tool_name: mcpBlock.toolName,
						arguments: JSON.stringify(mcpBlock.arguments),
					},
					partial: mcpBlock.partial,
					nativeArgs: {
						server_name: resolvedServerName,
						tool_name: mcpBlock.toolName,
						arguments: mcpBlock.arguments,
					},
				}

				await useMcpToolTool.handle(task, syntheticToolUse, {
					askApproval,
					handleError,
					pushToolResult,
				})

				break
			}
			case "text": {
				if (task._state.didRejectTool || task._state.didAlreadyUseTool) {
					break
				}

				// TextContent has 'text' not 'content'
				let content = (block as TextContent).text

				if (content) {
					// Have to do this for partial and complete since sending
					// content in thinking tags to markdown renderer will
					// automatically be removed.
					// Strip any streamed <thinking> tags from text output.
					content = content.replace(/<thinking>\s?/g, "")
					content = content.replace(/\s?<\/thinking>/g, "")
				}

				await agentBroadcast(task.taskId, "text", content, undefined, block.partial)
				break
			}
			case "tool_use": {
				// Native tool calling is the only supported tool calling mechanism.
				// A tool_use block without an id is invalid and cannot be executed.
				const toolCallId = (block as ToolUse).id
				if (!toolCallId) {
					const errorMessage =
						"Invalid tool call: missing tool_use.id. XML tool calls are no longer supported. Remove any XML tool markup (e.g. <read_file>...</read_file>) and use native tool calling instead."
					// Record a tool error for visibility/telemetry. Use the reported tool name if present.
					try {
						if (typeof (block as ToolUse).name === "string") {
							task.recordToolError((block as ToolUse).name as ToolName, errorMessage)
						}
					} catch {
						// Best-effort only
					}
					task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
					await systemBroadcast(task.taskId, "error", errorMessage)
					task.userMessageContent.push({ type: "text", text: errorMessage })
					task._state.setDidAlreadyUseTool(true)
					break
				}

				// Resolve mode, custom modes, experiments from MST and context
				const mode = task.taskMode
				const customModes = getBackendRootStore().settings.modes.customModes
				const stateExperiments: { [key: string]: unknown } = {}
				const disabledTools: string[] = []

				const toolDescription = (): string => {
					switch (block.name) {
						case "execute_command":
							return `[${block.name} for '${block.params.command}']`
						case "read_file":
							// Prefer native typed args when available; fall back to legacy params
							// Check if nativeArgs exists (native protocol)
							if (block.nativeArgs) {
								return readFileTool.getReadFileToolDescription(
									block.name,
									block.nativeArgs as { path?: string },
								)
							}
							return readFileTool.getReadFileToolDescription(block.name, block.params)
						case "write_to_file":
							return `[${block.name} for '${block.params.path}']`
						case "apply_diff":
							// Native-only: tool args are structured (no XML payloads).
							return block.params?.path ? `[${block.name} for '${block.params.path}']` : `[${block.name}]`
						case "search_files":
							return `[${block.name} for '${block.params.regex}'${
								block.params.file_pattern ? ` in '${block.params.file_pattern}'` : ""
							}]`
						case "edit":
						case "search_and_replace":
							return `[${block.name} for '${block.params.file_path}']`
						case "search_replace":
							return `[${block.name} for '${block.params.file_path}']`
						case "edit_file":
							return `[${block.name} for '${block.params.file_path}']`
						case "apply_patch":
							return `[${block.name}]`
						case "list_files":
							return `[${block.name} for '${block.params.path}']`
						case "use_mcp_tool":
							return `[${block.name} for '${block.params.server_name}']`
						case "access_mcp_resource":
							return `[${block.name} for '${block.params.server_name}']`
						case "ask_followup_question":
							return `[${block.name} for '${block.params.question}']`
						case "await_batch_completion":
							return `[${block.name}]`
						case "attempt_completion":
							return `[${block.name}]`
						case "switch_mode":
							return `[${block.name} to '${block.params.mode_slug}'${block.params.reason ? ` because: ${block.params.reason}` : ""}]`
						case "codebase_search":
							return `[${block.name} for '${block.params.query}']`
						case "read_command_output":
							return `[${block.name} for '${block.params.artifact_id}']`
						case "update_todo_list":
							return `[${block.name}]`
						case "new_task": {
							const mode = block.params.mode ?? defaultModeSlug
							const message = block.params.message ?? "(no message)"
							const modeName = getModeBySlug(mode, customModes as ModeConfig[] | undefined)?.name ?? mode
							return `[${block.name} in ${modeName} mode: '${message}']`
						}
						case "delegate_task": {
							const task_id = block.params.task_id ?? "(no id)"
							const target_role = block.params.target_role ?? "(no role)"
							const message = block.params.message ?? "(no message)"
							return `[${block.name} task "${task_id}" to ${target_role}: '${message}']`
						}
						case "run_slash_command":
							return `[${block.name} for '${block.params.command}'${block.params.args ? ` with args: ${block.params.args}` : ""}]`
						case "skill":
							return `[${block.name} for '${block.params.skill}'${block.params.args ? ` with args: ${block.params.args}` : ""}]`
						case "analyze_image":
						case "generate_image":
							return `[${block.name} for '${block.params.path}']`
						default:
							return `[${block.name}]`
					}
				}

				if (task._state.didRejectTool) {
					// Ignore any tool content after user has rejected tool once.
					// For native tool calling, we must send a tool_result for every tool_use to avoid API errors
					const errorMessage = !block.partial
						? `Skipping tool ${toolDescription()} due to user rejecting a previous tool.`
						: `Tool ${toolDescription()} was interrupted and not executed due to user rejecting a previous tool.`

					pushToolResultToUserContent(task.userMessageContent, {
						type: "tool_result",
						tool_use_id: sanitizeToolUseId(toolCallId),
						content: errorMessage,
						is_error: true,
					})

					break
				}

				// Track if we've already pushed a tool result for this tool call (native tool calling only)
				let hasToolResult = false

				// If this is a native tool call but the parser couldn't construct nativeArgs
				// (e.g., malformed/unfinished JSON in a streaming tool call), we must NOT attempt to
				// execute the tool. Instead, emit exactly one structured tool_result so the provider
				// receives a matching tool_result for the tool_use_id.
				//
				// This avoids executing an invalid tool_use block and prevents duplicate/fragmented
				// error reporting.
				if (!block.partial) {
					const customTool = stateExperiments?.customTools ? customToolRegistry.get(block.name) : undefined
					const isKnownTool = isValidToolName(
						String(block.name),
						stateExperiments as Record<string, boolean> | undefined,
					)
					if (isKnownTool && !block.nativeArgs && !customTool) {
						const errorMessage =
							`Invalid tool call for '${block.name}': missing nativeArgs. ` +
							`This usually means the model streamed invalid or incomplete arguments and the call could not be finalized.`

						task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
						try {
							task.recordToolError(block.name as ToolName, errorMessage)
						} catch {
							// Best-effort only
						}

						// Push tool_result directly without setting didAlreadyUseTool so streaming can
						// continue gracefully.
						pushToolResultToUserContent(task.userMessageContent, {
							type: "tool_result",
							tool_use_id: sanitizeToolUseId(toolCallId),
							content: formatResponse.toolError(errorMessage),
							is_error: true,
						})

						break
					}
				}

				// Store approval feedback to merge into tool result (GitHub #10465)
				let approvalFeedback: { text: string; images?: string[] } | undefined

				const pushToolResult = (content: ToolResponse) => {
					// Native tool calling: only allow ONE tool_result per tool call
					if (hasToolResult) {
						console.error(
							`[jabberwock] [presentAssistantMessage] Skipping duplicate tool_result for tool_use_id: ${toolCallId}`,
						)
						return
					}

					let resultContent: string
					let imageBlocks: Anthropic.ImageBlockParam[] = []

					if (typeof content === "string") {
						resultContent = content || "(tool did not return anything)"
					} else {
						const textBlocks = content.filter((item) => item.type === "text")
						imageBlocks = content.filter((item) => item.type === "image") as Anthropic.ImageBlockParam[]
						resultContent =
							textBlocks.map((item) => (item as Anthropic.TextBlockParam).text).join("\n") ||
							"(tool did not return anything)"
					}

					// Merge approval feedback into tool result (GitHub #10465)
					if (approvalFeedback) {
						const feedbackText = formatResponse.toolApprovedWithFeedback(approvalFeedback.text)
						resultContent = `${feedbackText}\n\n${resultContent}`
						if (approvalFeedback.images) {
							const feedbackImageBlocks = formatResponse.imageBlocks(approvalFeedback.images)
							imageBlocks = [...feedbackImageBlocks, ...imageBlocks]
						}
					}

					pushToolResultToUserContent(task.userMessageContent, {
						type: "tool_result",
						tool_use_id: sanitizeToolUseId(toolCallId),
						content: resultContent,
					})

					if (imageBlocks.length > 0) {
						task.userMessageContent.push(...imageBlocks)
					}

					hasToolResult = true
					// Notify devtool about tool call completion
					try {
						getBackendRootStore().chat.toolCallCompleted(block.name, resultContent)
					} catch {
						// Silently ignore - store may not be initialized yet
					}
				}

				const askApproval = async (
					type: NotificationAsk,
					partialMessage?: string,
					progressStatus?: ToolProgressStatus,
					isProtected?: boolean,
				) => {
					const { response, text, images } = await ask(
						task.taskId,
						type,
						partialMessage,
						false,
						progressStatus,
						isProtected || false,
					)

					if (response !== "yesButtonClicked") {
						// Handle both messageResponse and noButtonClicked with text.
						if (text) {
							await userBroadcast(task.taskId, "user_feedback", text, images)
							pushToolResult(
								formatResponse.toolResult(formatResponse.toolDeniedWithFeedback(text), images),
							)
						} else {
							pushToolResult(formatResponse.toolDenied())
						}
						task._state.setDidRejectTool(true)
						return false
					}

					// Store approval feedback to be merged into tool result (GitHub #10465)
					// Don't push it as a separate tool_result here - that would create duplicates.
					// The tool will call pushToolResult, which will merge the feedback into the actual result.
					if (text) {
						await userBroadcast(task.taskId, "user_feedback", text, images)
						approvalFeedback = { text, images }
					}

					return true
				}

				const askFinishSubTaskApproval = async () => {
					// Ask the user to approve this task has completed, and he has
					// reviewed it, and we can declare task is finished and return
					// control to the parent task to continue running the rest of
					// the sub-tasks.
					const toolMessage = JSON.stringify({ tool: "finishTask" })
					return await askApproval("tool", toolMessage)
				}

				const handleError = async (action: string, error: Error) => {
					// Silently ignore AskIgnoredError - this is an internal control flow
					// signal, not an actual error. It occurs when a newer ask supersedes an older one.
					if (error instanceof AskIgnoredError) {
						return
					}

					// If task was aborted, silence the error to prevent cascading crashes during mode switch or delegation
					if (
						task._state.abort ||
						task.currentRequestAbortController?.signal.aborted ||
						error.message?.includes("aborted")
					) {
						return
					}

					const errorString = `Error ${action}: ${JSON.stringify(serializeError(error))}`

					await systemBroadcast(
						task.taskId,
						"error",
						`Error ${action}:\n${error.message ?? JSON.stringify(serializeError(error), null, 2)}`,
					)

					pushToolResult(formatResponse.toolError(errorString))
					// Notify devtool about tool call error
					try {
						getBackendRootStore().chat.toolCallError(block.name, errorString)
					} catch {
						// Silently ignore - store may not be initialized yet
					}
				}

				if (!block.partial) {
					// Check if this is a custom tool - if so, record as "custom_tool" (like MCP tools)
					const isCustomTool = stateExperiments?.customTools && customToolRegistry.has(block.name)
					const recordName = isCustomTool ? "custom_tool" : block.name
					try {
						task.recordToolUsage(recordName)
					} catch (metricsError) {
						console.error(
							`[jabberwock] [metrics] Failed to record tool usage for '${recordName}':`,
							metricsError,
						)
					}
					getTelemetryService().captureToolUsage(task.taskId, recordName)

					// Track legacy format usage for read_file tool (for migration monitoring)
					if (block.name === "read_file" && block.usedLegacyFormat) {
						const modelInfo = task.api!.getModel()
						getTelemetryService().captureEvent(TelemetryEventName.READ_FILE_LEGACY_FORMAT_USED, {
							taskId: task.taskId,
							model: modelInfo?.id,
						})
					}
				}

				// Validate tool use before execution - ONLY for complete (non-partial) blocks.
				// Validating partial blocks would cause validation errors to be thrown repeatedly
				// during streaming, pushing multiple tool_results for the same tool_use_id and
				// potentially causing the stream to appear frozen.
				if (!block.partial) {
					const modelInfo = task.api!.getModel()
					// Resolve aliases in includedTools before validation
					// e.g., "edit_file" should resolve to "apply_diff"
					const rawIncludedTools = modelInfo?.info?.includedTools
					const { resolveToolAlias } = await import(
						"../../../../settings/context/tools/filter-tools-for-mode"
					)
					const includedTools = rawIncludedTools?.map((tool) => resolveToolAlias(tool))

					try {
						const toolRequirements =
							disabledTools?.reduce(
								(acc: Record<string, boolean>, tool: string) => {
									acc[tool] = false
									const resolvedToolName = resolveToolAlias(tool)
									acc[resolvedToolName] = false
									return acc
								},
								{} as Record<string, boolean>,
							) ?? {}

						validateToolUse(
							block.name as ToolName,
							mode ?? defaultModeSlug,
							(customModes ?? []) as ModeConfig[],
							toolRequirements,
							block.params,
							stateExperiments as Record<string, boolean> | undefined,
							includedTools,
						)
					} catch (error) {
						task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
						// For validation errors (unknown tool, tool not allowed for mode), we need to:
						// 1. Send a tool_result with the error (required for native tool calling)
						// 2. NOT set didAlreadyUseTool = true (the tool was never executed, just failed validation)
						// This prevents the stream from being interrupted with "Response interrupted by tool use result"
						// which would cause the extension to appear to hang
						const validationError = error instanceof Error ? error.message : String(error)
						const errorContent = formatResponse.toolError(validationError)
						// Push tool_result directly without setting didAlreadyUseTool
						pushToolResultToUserContent(task.userMessageContent, {
							type: "tool_result",
							tool_use_id: sanitizeToolUseId(toolCallId),
							content: typeof errorContent === "string" ? errorContent : "(validation error)",
							is_error: true,
						})

						break
					}
				}

				// Check for identical consecutive tool calls.
				if (!block.partial) {
					// Use the detector to check for repetition, passing the ToolUse
					// block directly.
					const repetitionCheck = task.toolRepetitionDetector!.check(block)

					// If execution is not allowed, notify user and break.
					if (!repetitionCheck.allowExecution && repetitionCheck.askUser) {
						// Handle repetition similar to mistake_limit_reached pattern.
						const { response, text, images } = await ask(
							task.taskId,
							repetitionCheck.askUser.messageKey as NotificationAsk,
							repetitionCheck.askUser.messageDetail.replace("{toolName}", block.name),
						)

						if (response === "messageResponse") {
							// Add user feedback to userContent.
							task.userMessageContent.push(
								{
									type: "text" as const,
									text: `Tool repetition limit reached. User feedback: ${text}`,
								},
								...formatResponse.imageBlocks(images),
							)

							// Add user feedback to chat.
							await userBroadcast(task.taskId, "user_feedback", text, images)
						}

						// Track tool repetition in telemetry via PostHog exception tracking and event.
						getTelemetryService().captureConsecutiveMistakeError(task.taskId)
						getTelemetryService().captureException(
							new ConsecutiveMistakeError(
								`Tool repetition limit reached for ${block.name}`,
								task.taskId,
								task._state.consecutiveMistakeCount,
								task._state.consecutiveMistakeLimit,
								"tool_repetition",
								task.apiConfiguration.apiProvider,
								task.api!.getModel().id,
							),
						)

						// Return tool result message about the repetition
						pushToolResult(
							formatResponse.toolError(
								`Tool call repetition limit reached for ${block.name}. Please try a different approach.`,
							),
						)
						break
					}
				}

				// Phase 4: Dynamic Tool Delegation
				// Orchestrator cannot mutate code directly; it must delegate to a Coder branch.
				const mutatingTools = [
					"write_to_file",
					"apply_diff",
					"edit",
					"search_and_replace",
					"search_replace",
					"edit_file",
					"apply_patch",
					"execute_command",
					"generate_image",
					"analyze_image",
				]
				if (mode === "orchestrator" && mutatingTools.includes(block.name)) {
					const provider = task.providerRef!.deref()
					if (provider) {
						const message = `I am delegating the execution of the '${block.name}' tool to you.
Params: ${JSON.stringify(block.params, null, 2)}
Please execute this tool and confirm once done.`

						// Reset the tool repetition detector — the orchestrator legitimately
						// used a tool that was intercepted for delegation. Without this reset,
						// the orchestrator would hit the repetition limit after 3 identical
						// intercepted calls, triggering a false "mistake_limit_reached".
						task.toolRepetitionDetector!.reset()
						// Also reset consecutive mistake count since the tool was handled successfully
						task._state.setConsecutiveMistakeCount(0)

						// Inform the orchestrator that we're delegating
						pushToolResult(
							`[Auto-Delegation] Intercepted '${block.name}' call. Spawning a 'Coder' sub-agent branch to perform this action.`,
						)

						// Trigger delegation to a new coder branch
						void delegateParentAndOpenChild(provider, {
							parentTaskId: task.taskId,
							message,
							mode: "coder",
						})
						break
					}
				}
				if (!block.partial && block.name) {
					diagnosticsManager.setCurrentAction(t("diagnostics:actions.executingTool", { tool: block.name }))

					// Phase 2: RBAC (Tool Permission Check)
					const toolName = block.name as string
					const modeSlug = mode ?? defaultModeSlug
					if (agentStore.agents.has(modeSlug)) {
						const agent = agentStore.agents.get(modeSlug)
						if (agent && !agent.canUseTool(toolName)) {
							const errorMessage = `Tool '${toolName}' is not allowed for your current role (${modeSlug}).`
							pushToolResult(formatResponse.toolError(errorMessage))
							break
						}
					}
				}

				// Phase 5: Tool Call Lifecycle — Notify devtool about tool call start
				if (!block.partial) {
					try {
						getBackendRootStore().chat.toolCallStarted(block.name, JSON.stringify(block.params))
					} catch {
						// Silently ignore - store may not be initialized yet
					}
				}

				switch (block.name) {
					case "write_to_file":
						await checkpointSaveAndMark(task)
						await writeToFileTool.handle(task, block as ToolUse<"write_to_file">, {
							askApproval,
							handleError,
							pushToolResult,
						})
						break
					case "update_todo_list":
						await updateTodoListTool.handle(task, block as ToolUse<"update_todo_list">, {
							askApproval,
							handleError,
							pushToolResult,
						})
						break
					case "apply_diff":
						await checkpointSaveAndMark(task)
						await applyDiffToolClass.handle(task, block as ToolUse<"apply_diff">, {
							askApproval,
							handleError,
							pushToolResult,
						})
						break
					case "edit":
					case "search_and_replace":
						await checkpointSaveAndMark(task)
						await editTool.handle(task, block as ToolUse<"edit">, {
							askApproval,
							handleError,
							pushToolResult,
						})
						break
					case "search_replace":
						await checkpointSaveAndMark(task)
						await searchReplaceTool.handle(task, block as ToolUse<"search_replace">, {
							askApproval,
							handleError,
							pushToolResult,
						})
						break
					case "edit_file":
						await checkpointSaveAndMark(task)
						await editFileTool.handle(task, block as ToolUse<"edit_file">, {
							askApproval,
							handleError,
							pushToolResult,
						})
						break
					case "apply_patch":
						await checkpointSaveAndMark(task)
						await applyPatchTool.handle(task, block as ToolUse<"apply_patch">, {
							askApproval,
							handleError,
							pushToolResult,
						})
						break
					case "read_file":
						// Type assertion is safe here because we're in the "read_file" case
						await readFileTool.handle(task, block as ToolUse<"read_file">, {
							askApproval,
							handleError,
							pushToolResult,
						})
						break
					case "list_files":
						await listFilesTool.handle(task, block as ToolUse<"list_files">, {
							askApproval,
							handleError,
							pushToolResult,
						})
						break
					case "codebase_search":
						await codebaseSearchTool.handle(task, block as ToolUse<"codebase_search">, {
							askApproval,
							handleError,
							pushToolResult,
						})
						break
					case "search_files":
						await searchFilesTool.handle(task, block as ToolUse<"search_files">, {
							askApproval,
							handleError,
							pushToolResult,
						})
						break
					case "execute_command":
						await executeCommandTool.handle(task, block as ToolUse<"execute_command">, {
							askApproval,
							handleError,
							pushToolResult,
						})
						break
					case "read_command_output":
						await readCommandOutputTool.handle(task, block as ToolUse<"read_command_output">, {
							askApproval,
							handleError,
							pushToolResult,
						})
						break
					case "use_mcp_tool":
						await useMcpToolTool.handle(task, block as ToolUse<"use_mcp_tool">, {
							askApproval,
							handleError,
							pushToolResult,
						})
						break
					case "access_mcp_resource":
						await accessMcpResourceTool.handle(task, block as ToolUse<"access_mcp_resource">, {
							askApproval,
							handleError,
							pushToolResult,
						})
						break
					case "ask_followup_question":
						await askFollowupQuestionTool.handle(task, block as ToolUse<"ask_followup_question">, {
							askApproval,
							handleError,
							pushToolResult,
						})
						break
					case "switch_mode":
						await switchModeTool.handle(task, block as ToolUse<"switch_mode">, {
							askApproval,
							handleError,
							pushToolResult,
						})
						break
					case "await_batch_completion":
						await awaitBatchCompletionTool.handle(task, block as ToolUse<"await_batch_completion">, {
							askApproval,
							handleError,
							pushToolResult,
						})
						break
					case "new_task":
						await checkpointSaveAndMark(task)
						await newTaskTool.handle(task, block as ToolUse<"new_task">, {
							askApproval,
							handleError,
							pushToolResult,
							toolCallId: block.id,
						})
						break
					case "delegate_task":
						await checkpointSaveAndMark(task)
						await delegateTaskTool.handle(task, block as ToolUse<"delegate_task">, {
							askApproval,
							handleError,
							pushToolResult,
						})
						break
					case "attempt_completion": {
						const completionCallbacks: AttemptCompletionCallbacks = {
							askApproval,
							handleError,
							pushToolResult,
							askFinishSubTaskApproval,
							toolDescription,
						}
						await attemptCompletionTool.handle(
							task,
							block as ToolUse<"attempt_completion">,
							completionCallbacks,
						)
						break
					}
					case "think_tool":
						await thinkTool.handle(task, block as ToolUse<"think_tool">, {
							askApproval,
							handleError,
							pushToolResult,
						})
						break
					case "run_slash_command":
						await runSlashCommandTool.handle(task, block as ToolUse<"run_slash_command">, {
							askApproval,
							handleError,
							pushToolResult,
						})
						break
					case "skill":
						await skillTool.handle(task, block as ToolUse<"skill">, {
							askApproval,
							handleError,
							pushToolResult,
						})
						break
					case "analyze_image": {
						const analyzeImageTool = (await import("../../../tools/AnalyzeImageTool")).analyzeImageTool
						await checkpointSaveAndMark(task)
						await analyzeImageTool.handle(task, block as ToolUse<"analyze_image">, {
							askApproval,
							handleError,
							pushToolResult,
						})
						break
					}
					case "generate_image":
						await checkpointSaveAndMark(task)
						await generateImageTool.handle(task, block as ToolUse<"generate_image">, {
							askApproval,
							handleError,
							pushToolResult,
						})
						break
					default: {
						// Handle unknown/invalid tool names OR custom tools
						// This is critical for native tool calling where every tool_use MUST have a tool_result

						// CRITICAL: Don't process partial blocks for unknown tools - just let them stream in.
						// If we try to show errors for partial blocks, we'd show the error on every streaming chunk,
						// creating a loop that appears to freeze the extension. Only handle complete blocks.
						if (block.partial) {
							break
						}

						const customTool = stateExperiments?.customTools
							? customToolRegistry.get(block.name)
							: undefined

						if (customTool) {
							try {
								let customToolArgs: { [key: string]: unknown } = {}

								if (customTool.parameters) {
									try {
										customToolArgs = customTool.parameters.parse(
											block.nativeArgs || block.params || {},
										) as { [key: string]: unknown }
									} catch (parseParamsError) {
										const parseError =
											parseParamsError instanceof Error
												? parseParamsError.message
												: String(parseParamsError)
										const message = `Custom tool "${block.name}" argument validation failed: ${parseError}`
										console.error(message)
										task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
										await systemBroadcast(task.taskId, "error", message)
										pushToolResult(formatResponse.toolError(message))
										break
									}
								}

								const executionResult = await customTool.execute(customToolArgs, {
									mode: mode ?? defaultModeSlug,
									task: task as ITaskModel & import("@jabberwock/types").TaskLike,
								})

								console.log(
									`${customTool.name}.execute(): ${JSON.stringify(customToolArgs)} -> ${JSON.stringify(executionResult)}`,
								)

								pushToolResult(executionResult)
								task._state.setConsecutiveMistakeCount(0)
								// Custom tools return a string, not a delegation result object
								// so we don't assign to `result` (which expects { isDelegated?: boolean })
							} catch (executionError: unknown) {
								const msg =
									executionError instanceof Error ? executionError.message : String(executionError)
								task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
								task.recordToolError("custom_tool", msg)
								await handleError(
									`executing custom tool "${block.name}"`,
									executionError instanceof Error ? executionError : new Error(msg),
								)
							}

							break
						}

						// Not a custom tool - handle as unknown tool error
						const errorMessage = `Unknown tool "${block.name}". This tool does not exist. Please use one of the available tools.`
						task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
						task.recordToolError(block.name as ToolName, errorMessage)
						await systemBroadcast(
							task.taskId,
							"error",
							t("tools:unknownToolError", { toolName: block.name }),
						)
						// Push tool_result directly WITHOUT setting didAlreadyUseTool
						// This prevents the stream from being interrupted with "Response interrupted by tool use result"
						pushToolResultToUserContent(task.userMessageContent, {
							type: "tool_result",
							tool_use_id: sanitizeToolUseId(toolCallId),
							content: formatResponse.toolError(errorMessage),
							is_error: true,
						})
						break
					}
				}

				break
			}
		}

		// Seeing out of bounds is fine, it means that the next too call is being
		// built up and ready to add to assistantMessageContent to present.
		// When you see the UI inactive during this, it means that a tool is
		// breaking without presenting any UI. For example the write_to_file tool
		// was breaking when relpath was undefined, and for invalid relpath it never
		// presented UI.
		// This needs to be placed here, if not then calling
		// task.presentAssistantMessage below would fail (sometimes) since it's
		// locked.
		task._state.setPresentAssistantMessageLocked(false)

		// NOTE: When tool is rejected, iterator stream is interrupted and it waits
		// for `userMessageContentReady` to be true. Future calls to present will
		// skip execution since `didRejectTool` and iterate until `contentIndex` is
		// set to message length and it sets userMessageContentReady to true itself
		// (instead of preemptively doing it in iterator).
		if (!block.partial || task._state.didRejectTool || task._state.didAlreadyUseTool) {
			// Block is finished streaming and executing.
			if (task._state.currentStreamingContentIndex === task.assistantMessageContent.length - 1) {
				// It's okay that we increment if !didCompleteReadingStream, it'll
				// just return because out of bounds and as streaming continues it
				// will call `presentAssitantMessage` if a new block is ready. If
				// streaming is finished then we set `userMessageContentReady` to
				// true when out of bounds. This gracefully allows the stream to
				// continue on and all potential content blocks be presented.
				// Last block is complete and it is finished executing
				task._state.setUserMessageContentReady(true) // Will allow `pWaitFor` to continue.
			}

			// Call next block if it exists (if not then read stream will call it
			// when it's ready).
			// Need to increment regardless, so when read stream calls this function
			// again it will be streaming the next block.
			task._state.setCurrentStreamingContentIndex(task._state.currentStreamingContentIndex + 1)

			if (task._state.currentStreamingContentIndex < task.assistantMessageContent.length) {
				// There are already more content blocks to stream, so we'll call
				// this function ourselves.
				presentAssistantMessage(task)
				return
			} else {
				// CRITICAL FIX: If we're out of bounds and the stream is complete, set userMessageContentReady
				// This handles the case where assistantMessageContent is empty or becomes empty after processing
				if (task._state.didCompleteReadingStream) {
					task._state.setUserMessageContentReady(true)
				}
			}
		}

		// Block is partial, but the read stream may have finished.
		if (task._state.presentAssistantMessageHasPendingUpdates) {
			// CRITICAL: Reset the flag BEFORE re-calling to break the infinite re-entry loop.
			// If we don't reset, the recursive call will see the flag still set, and
			// combined with concurrent stream chunk handlers setting it again, this
			// creates an infinite recurrence loop.
			task._state.setPresentAssistantMessageHasPendingUpdates(false)
			presentAssistantMessage(task)
		}
	} catch (error) {
		console.error(`[jabberwock] [presentAssistantMessage] Error processing assistant message:`, error)
		task._state.setPresentAssistantMessageLocked(false)
		task._state.setUserMessageContentReady(true)
	} finally {
		presentAssistantMessageRecursionDepth--
	}

	/**
	 * save checkpoint and mark done in the current streaming task.
	 * @param task The Task instance to checkpoint save and mark.
	 * @returns
	 */
	async function checkpointSaveAndMark(task: ITaskModel) {
		if (task._state.currentStreamingDidCheckpoint) {
			return
		}
		try {
			await checkpointSave(task, true)
			task._state.setCurrentStreamingDidCheckpoint(true)
		} catch (error) {
			const checkpointError = error instanceof Error ? error.message : String(error)
			console.error(
				`[jabberwock] [Task#presentAssistantMessage] Error saving checkpoint: ${checkpointError}`,
				error,
			)
		}
	}
}
