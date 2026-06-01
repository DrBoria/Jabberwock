/**
 * Cloud feature — event type constants.
 * These map to webview message types routed through webviewMessageHandler.
 */
export const cloudEventConstants = {
	CLOUD_BUTTON_CLICKED: "cloudButtonClicked" as const,
	JABBERWOCK_CLOUD_SIGN_IN: "jabberwockCloudSignIn" as const,
	CLOUD_LANDING_PAGE_SIGN_IN: "cloudLandingPageSignIn" as const,
	JABBERWOCK_CLOUD_SIGN_OUT: "jabberwockCloudSignOut" as const,
	JABBERWOCK_CLOUD_MANUAL_URL: "jabberwockCloudManualUrl" as const,
	OPEN_AI_CODEX_SIGN_IN: "openAiCodexSignIn" as const,
	OPEN_AI_CODEX_SIGN_OUT: "openAiCodexSignOut" as const,
	SWITCH_ORGANIZATION: "switchOrganization" as const,
	CLEAR_CLOUD_AUTH_SKIP_MODEL: "clearCloudAuthSkipModel" as const,
} as const

/**
 * Monolithic-style aliases for backward compatibility with webview-mappings imports.
 * These map to the same values as cloudEventConstants but use the UPPER_SNAKE_CASE
 * naming convention from packages/types/src/event-constants.ts.
 */
export const CLOUD_CLOUD_BUTTON_CLICKED = cloudEventConstants.CLOUD_BUTTON_CLICKED
export const CLOUD_JABBERWOCK_CLOUD_SIGN_IN = cloudEventConstants.JABBERWOCK_CLOUD_SIGN_IN
export const CLOUD_CLOUD_LANDING_PAGE_SIGN_IN = cloudEventConstants.CLOUD_LANDING_PAGE_SIGN_IN
export const CLOUD_JABBERWOCK_CLOUD_SIGN_OUT = cloudEventConstants.JABBERWOCK_CLOUD_SIGN_OUT
export const CLOUD_JABBERWOCK_CLOUD_MANUAL_URL = cloudEventConstants.JABBERWOCK_CLOUD_MANUAL_URL
export const CLOUD_OPEN_AI_CODEX_SIGN_IN = cloudEventConstants.OPEN_AI_CODEX_SIGN_IN
export const CLOUD_OPEN_AI_CODEX_SIGN_OUT = cloudEventConstants.OPEN_AI_CODEX_SIGN_OUT
export const CLOUD_SWITCH_ORGANIZATION = cloudEventConstants.SWITCH_ORGANIZATION
export const CLOUD_CLEAR_CLOUD_AUTH_SKIP_MODEL = cloudEventConstants.CLEAR_CLOUD_AUTH_SKIP_MODEL

export type CloudEventKey = (typeof cloudEventConstants)[keyof typeof cloudEventConstants]
