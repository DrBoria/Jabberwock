/**
 * Frontend Cloud event key constants.
 *
 * Naming convention: [Feature]_[Action] in UPPER_SNAKE_CASE.
 */
export const frontendCloudEventConstants = {} as const

export type FrontendCloudEventKey = (typeof frontendCloudEventConstants)[keyof typeof frontendCloudEventConstants]
