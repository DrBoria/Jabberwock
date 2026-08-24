/**
 * Frontend History event key constants.
 *
 * Naming convention: [Feature]_[Action] in UPPER_SNAKE_CASE.
 */
export const frontendHistoryEventConstants = {} as const

export type FrontendHistoryEventKey = (typeof frontendHistoryEventConstants)[keyof typeof frontendHistoryEventConstants]
