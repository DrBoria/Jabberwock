import { z } from "zod"

/**
 * @deprecated "say" type is being replaced by ChatMessage discriminated union types.
 * Use packages/types/src/message.ts ChatMessage (UserMessage | AgentMessage | McpToolMessage | SystemMessage).
 * All new code should produce ChatMessage instead of Notification with type "say".
 *
 * See architectural-restructure-v2.md §3 for migration guide.
 */

/**
 * @deprecated Use ChatMessage types instead.
 * Array of possible say types that represent different kinds of messages the assistant can send.
 * These are used to categorize and handle various types of communication from the LLM to the user.
 *
 * @constant
 * @readonly
 *
 * Say type descriptions:
 * - `error`: General error message
 * - `api_req_started`: Indicates an API request has been initiated
 * - `api_req_finished`: Indicates an API request has completed successfully
 * - `api_req_retried`: Indicates an API request is being retried after a failure
 * - `api_req_retry_delayed`: Indicates an API request retry has been delayed
 * - `api_req_rate_limit_wait`: Indicates a configured rate-limit wait (not an error)
 * - `api_req_deleted`: Indicates an API request has been deleted/cancelled
 * - `text`: General text message or assistant response
 * - `reasoning`: Assistant's reasoning or thought process (often hidden from user)
 * - `completion_result`: Final result of task completion
 * - `user_feedback`: Message containing user feedback
 * - `user_feedback_diff`: Diff-formatted feedback from user showing requested changes
 * - `command_output`: Output from an executed command
 * - `shell_integration_warning`: Warning about shell integration issues or limitations
 * - `mcp_server_request_started`: MCP server request has been initiated
 * - `mcp_server_response`: Response received from MCP server
 * - `subtask_result`: Result of a completed subtask
 * - `checkpoint_saved`: Indicates a checkpoint has been saved
 * - `rooignore_error`: Error related to .jabberwockignore file processing
 * - `diff_error`: Error occurred while applying a diff/patch
 * - `condense_context`: Context condensation/summarization has started
 * - `condense_context_error`: Error occurred during context condensation
 * - `codebase_search_result`: Results from searching the codebase
 * - `too_many_tools_warning`: Warning that too many MCP tools are enabled, which may confuse the LLM
 */
export const notificationSayTypes = [
	"error",
	"api_req_started",
	"api_req_finished",
	"api_req_retried",
	"api_req_retry_delayed",
	"api_req_rate_limit_wait",
	"api_req_deleted",
	"text",
	"image",
	"reasoning",
	"completion_result",
	"user_feedback",
	"user_feedback_diff",
	"command_output",
	"shell_integration_warning",
	"mcp_server_request_started",
	"mcp_server_response",
	"subtask_result",
	"checkpoint_saved",
	"rooignore_error",
	"diff_error",
	"condense_context",
	"condense_context_error",
	"sliding_window_truncation",
	"codebase_search_result",
	"user_edit_todos",
	"too_many_tools_warning",
	"tool",
	"api_req_feedback",
] as const

export const notificationSaySchema = z.enum(notificationSayTypes)

export type NotificationSay = z.infer<typeof notificationSaySchema>
