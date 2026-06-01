/**
 * Frontend Settings event key constants.
 *
 * Naming convention: [Feature]_[Action] in UPPER_SNAKE_CASE.
 */
export const frontendSettingsEventConstants = {} as const

export type FrontendSettingsEventKey =
	(typeof frontendSettingsEventConstants)[keyof typeof frontendSettingsEventConstants]
