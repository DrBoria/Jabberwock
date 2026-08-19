/**
 * History feature — event type constants.
 * These map to webview message types routed through webviewMessageHandler.
 */
export const historyEventConstants = {
	SEARCH_COMMITS: "searchCommits" as const,
	IMPORT_SETTINGS: "importSettings" as const,
	EXPORT_SETTINGS: "exportSettings" as const,
	RESET_STATE: "resetState" as const,
	HISTORY_BUTTON_CLICKED: "historyButtonClicked" as const,
} as const

/**
 * Monolithic-style aliases for backward compatibility with webview-mappings imports.
 */
export const HISTORY_SEARCH_COMMITS = historyEventConstants.SEARCH_COMMITS
export const HISTORY_IMPORT_SETTINGS = historyEventConstants.IMPORT_SETTINGS
export const HISTORY_EXPORT_SETTINGS = historyEventConstants.EXPORT_SETTINGS
export const HISTORY_RESET_STATE = historyEventConstants.RESET_STATE
export const HISTORY_HISTORY_BUTTON_CLICKED = historyEventConstants.HISTORY_BUTTON_CLICKED

export type HistoryEventKey = (typeof historyEventConstants)[keyof typeof historyEventConstants]
