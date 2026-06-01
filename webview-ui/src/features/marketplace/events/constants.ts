/**
 * Frontend Marketplace event key constants.
 *
 * Naming convention: [Feature]_[Action] in UPPER_SNAKE_CASE.
 */
export const frontendMarketplaceEventConstants = {} as const

export type FrontendMarketplaceEventKey =
	(typeof frontendMarketplaceEventConstants)[keyof typeof frontendMarketplaceEventConstants]
