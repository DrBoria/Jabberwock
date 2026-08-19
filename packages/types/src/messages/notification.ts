import { z } from "zod"

import { notificationAskSchema } from "./notification-ask.ts"
import { notificationSaySchema } from "./notification-say.ts"

/**
 * ToolProgressStatus
 */

export const toolProgressStatusSchema = z.object({
	icon: z.string().optional(),
	text: z.string().optional(),
})

export type ToolProgressStatus = z.infer<typeof toolProgressStatusSchema>

/**
 * ContextCondense
 *
 * Data associated with a successful context condensation event.
 * This is attached to notifications with `say: "condense_context"` when
 * the condensation operation completes successfully.
 */
export const contextCondenseSchema = z.object({
	cost: z.number(),
	prevContextTokens: z.number(),
	newContextTokens: z.number(),
	summary: z.string(),
	condenseId: z.string().optional(),
})

export type ContextCondense = z.infer<typeof contextCondenseSchema>

/**
 * ContextTruncation
 *
 * Data associated with a sliding window truncation event.
 * This is attached to notifications with `say: "sliding_window_truncation"`.
 */
export const contextTruncationSchema = z.object({
	truncationId: z.string(),
	messagesRemoved: z.number(),
	prevContextTokens: z.number(),
	newContextTokens: z.number(),
})

export type ContextTruncation = z.infer<typeof contextTruncationSchema>

/**
 * Notification
 *
 * The main notification type used for communication between the extension and webview.
 * Notifications represent system-to-user interaction prompts — either "ask" (requiring
 * user response, e.g. tool approval) or "say" (informational, e.g. operation result).
 *
 * Context Management Fields:
 * - `contextCondense`: Present when `say: "condense_context"` and condensation succeeded
 * - `contextTruncation`: Present when `say: "sliding_window_truncation"` and truncation occurred
 *
 * Note: These fields are mutually exclusive — a notification will have at most one of them.
 */
export const notificationSchema = z.object({
	ts: z.number(),
	type: z.union([z.literal("ask"), z.literal("say")]),
	ask: notificationAskSchema.optional(),
	say: notificationSaySchema.optional(),
	text: z.string().optional(),
	images: z.array(z.string()).optional(),
	partial: z.boolean().optional(),
	reasoning: z.string().optional(),
	conversationHistoryIndex: z.number().optional(),
	checkpoint: z.record(z.string(), z.unknown()).optional(),
	progressStatus: toolProgressStatusSchema.optional(),
	mode: z.string().optional(),
	contextCondense: contextCondenseSchema.optional(),
	contextTruncation: contextTruncationSchema.optional(),
	isProtected: z.boolean().optional(),
	apiProtocol: z.union([z.literal("openai"), z.literal("anthropic")]).optional(),
	isAnswered: z.boolean().optional(),
})

export type Notification = z.infer<typeof notificationSchema>
