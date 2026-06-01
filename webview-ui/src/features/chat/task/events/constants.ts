/**
 * Frontend Chat Task event key constants.
 *
 * Naming convention: [Feature]_[Action] in UPPER_SNAKE_CASE.
 */
export const FrontendChatTaskEventKeys = {} as const

export type FrontendChatTaskEventKeys = (typeof FrontendChatTaskEventKeys)[keyof typeof FrontendChatTaskEventKeys]
