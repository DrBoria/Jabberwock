/**
 * Frontend Chat Notifications event key constants.
 *
 * Naming convention: [Feature]_[Action] in UPPER_SNAKE_CASE.
 */
export const FrontendChatNotificationsEventKeys = {} as const

export type FrontendChatNotificationsEventKeys =
	(typeof FrontendChatNotificationsEventKeys)[keyof typeof FrontendChatNotificationsEventKeys]
