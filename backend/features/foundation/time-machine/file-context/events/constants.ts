/**
 * File context event key constants.
 *
 * These keys map 1:1 to the event types sent via EventBridge IPC.
 * Naming convention: [Feature]_[Action] in UPPER_SNAKE_CASE.
 */
export const FileContextEventKeys = {
	CONTEXT_MANAGEMENT_REQUIRED: "context.management.required",
	CONTEXT_WINDOW_EXCEEDED: "context.window.exceeded",
} as const

export type FileContextEventKeys = (typeof FileContextEventKeys)[keyof typeof FileContextEventKeys]
