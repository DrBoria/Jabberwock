/**
 * Frontend Diagnostics event key constants.
 *
 * Naming convention: [Feature]_[Action] in UPPER_SNAKE_CASE.
 */
export const frontendDiagnosticsEventConstants = {} as const

export type FrontendDiagnosticsEventKey =
	(typeof frontendDiagnosticsEventConstants)[keyof typeof frontendDiagnosticsEventConstants]
