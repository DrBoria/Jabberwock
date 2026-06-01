/**
 * Frontend Chat event key constants.
 *
 * These keys map 1:1 to event types sent via EventBridge IPC (frontend side).
 * Naming convention: [Feature]_[Action] in UPPER_SNAKE_CASE.
 */
export const FrontendChatEventKeys = {} as const

export type FrontendChatEventKeys = (typeof FrontendChatEventKeys)[keyof typeof FrontendChatEventKeys]
