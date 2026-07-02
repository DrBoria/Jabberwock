import { z } from "zod"

/**
 * NotificationAsk
 *
 * Array of possible ask types that the LLM can use to request user interaction or approval.
 * These represent different scenarios where the assistant needs user input to proceed.
 *
 * @constant
 * @readonly
 *
 * Ask type descriptions:
 * - `followup`: LLM asks a clarifying question to gather more information needed to complete the task
 * - `command`: Permission to execute a terminal/shell command
 * - `command_output`: Permission to read the output from a previously executed command
 * - `completion_result`: Task has been completed, awaiting user feedback or a new task
 * - `tool`: Permission to use a tool for file operations (read, write, search, etc.)
 * - `api_req_failed`: API request failed, asking user whether to retry
 * - `resume_task`: Confirmation needed to resume a previously paused task
 * - `resume_completed_task`: Confirmation needed to resume a task that was already marked as completed
 * - `mistake_limit_reached`: Too many errors encountered, needs user guidance on how to proceed
 * - `use_mcp_server`: Permission to use Model Context Protocol (MCP) server functionality
 * - `auto_approval_max_req_reached`: Auto-approval limit has been reached, manual approval required
 */
export const notificationAskTypes = [
	"followup",
	"command",
	"command_output",
	"completion_result",
	"tool",
	"api_req_failed",
	"resume_task",
	"resume_completed_task",
	"mistake_limit_reached",
	"use_mcp_server",
	"interactive_app",
	"auto_approval_max_req_reached",
] as const

export const notificationAskSchema = z.enum(notificationAskTypes)

export type NotificationAsk = z.infer<typeof notificationAskSchema>

/**
 * IdleAsk
 *
 * Asks that put the task into an "idle" state.
 */

export const idleAsks = [
	"completion_result",
	"api_req_failed",
	"resume_completed_task",
	"mistake_limit_reached",
	"auto_approval_max_req_reached",
] as const satisfies readonly NotificationAsk[]

export type IdleAsk = (typeof idleAsks)[number]

/**
 * ResumableAsk
 *
 * Asks that put the task into an "resumable" state.
 */

export const resumableAsks = ["resume_task"] as const satisfies readonly NotificationAsk[]

export type ResumableAsk = (typeof resumableAsks)[number]

/**
 * InteractiveAsk
 *
 * Asks that put the task into an "user interaction required" state.
 */

export const interactiveAsks = [
	"followup",
	"command",
	"tool",
	"use_mcp_server",
	"interactive_app",
] as const satisfies readonly NotificationAsk[]

export type InteractiveAsk = (typeof interactiveAsks)[number]

/**
 * NonBlockingAsk
 *
 * Asks that are not associated with an actual approval, and are only used
 * to update chat messages.
 */

export const nonBlockingAsks = ["command_output"] as const satisfies readonly NotificationAsk[]

export type NonBlockingAsk = (typeof nonBlockingAsks)[number]

/**
 * Type guard to check if a NotificationAsk is an idle ask type.
 */
export const isIdleAsk = (ask: NotificationAsk): ask is IdleAsk =>
	ask === "completion_result" ||
	ask === "api_req_failed" ||
	ask === "resume_completed_task" ||
	ask === "mistake_limit_reached" ||
	ask === "auto_approval_max_req_reached"

/**
 * Type guard to check if a NotificationAsk is a resumable ask type.
 */
export const isResumableAsk = (ask: NotificationAsk): ask is ResumableAsk => ask === "resume_task"

/**
 * Type guard to check if a NotificationAsk is an interactive ask type.
 */
export const isInteractiveAsk = (ask: NotificationAsk): ask is InteractiveAsk =>
	ask === "followup" || ask === "command" || ask === "tool" || ask === "use_mcp_server" || ask === "interactive_app"

/**
 * Type guard to check if a NotificationAsk is a non-blocking ask type.
 */
export const isNonBlockingAsk = (ask: NotificationAsk): ask is NonBlockingAsk => ask === "command_output"
