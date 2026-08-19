/**
 * API feature — event type constants.
 * These map to frontend-facing events routed through EventBridge.
 */
export const apiEventConstants = {} as const

export type ApiEventKey = (typeof apiEventConstants)[keyof typeof apiEventConstants]
