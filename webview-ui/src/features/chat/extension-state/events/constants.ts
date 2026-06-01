import { eventConstants } from "@jabberwock/types"

/**
 * ExtensionState event keys — maps to backend feature-level events.
 * Re-exports shared event constants for the extension-state sub-feature.
 */
export const extensionStateEventConstants = {
	STATE_UPDATED: eventConstants.MST.MST_SNAPSHOT_BATCH,
	/** Add feature-specific overrides here if returning extra data */
} as const
