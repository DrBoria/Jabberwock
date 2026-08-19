/**
 * Frontend Window Manager event key constants.
 *
 * These keys map 1:1 to event types sent via EventBridge IPC (frontend side).
 * Naming convention: [Feature]_[Action] in UPPER_SNAKE_CASE.
 */
export const FrontendWindowManagerEventKeys = {} as const

export type FrontendWindowManagerEventKeys =
	(typeof FrontendWindowManagerEventKeys)[keyof typeof FrontendWindowManagerEventKeys]
