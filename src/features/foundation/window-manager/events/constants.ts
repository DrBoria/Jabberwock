/**
 * Window Manager feature — event type constants.
 * These map to webview message types routed through webviewMessageHandler.
 */
export const windowManagerEventConstants = {
	FOCUS_PANEL_REQUEST: "focusPanelRequest" as const,
	SWITCH_TAB: "switchTab" as const,
	ACTIVE_PAGE_RESPONSE: "activePageResponse" as const,
	REQUEST_STATE: "requestState" as const,
	GET_TASK_WITH_AGGREGATED_COSTS: "getTaskWithAggregatedCosts" as const,
	SHOW_TASK_WITH_ID: "showTaskWithId" as const,
	DELETE_TASK_WITH_ID: "deleteTaskWithId" as const,
	EXPORT_TASK_WITH_ID: "exportTaskWithId" as const,
	EXPORT_CURRENT_TASK: "exportCurrentTask" as const,
	DELETE_MULTIPLE_TASKS: "deleteMultipleTasksWithIds" as const,
} as const

/**
 * Monolithic-style aliases for backward compatibility with webview-mappings imports.
 */
export const WINDOW_MANAGER_FOCUS_PANEL_REQUEST = windowManagerEventConstants.FOCUS_PANEL_REQUEST
export const WINDOW_MANAGER_SWITCH_TAB = windowManagerEventConstants.SWITCH_TAB
export const WINDOW_MANAGER_ACTIVE_PAGE_RESPONSE = windowManagerEventConstants.ACTIVE_PAGE_RESPONSE
export const WINDOW_MANAGER_REQUEST_STATE = windowManagerEventConstants.REQUEST_STATE
export const WINDOW_MANAGER_GET_TASK_WITH_AGGREGATED_COSTS = windowManagerEventConstants.GET_TASK_WITH_AGGREGATED_COSTS
export const WINDOW_MANAGER_SHOW_TASK_WITH_ID = windowManagerEventConstants.SHOW_TASK_WITH_ID
export const WINDOW_MANAGER_DELETE_TASK_WITH_ID = windowManagerEventConstants.DELETE_TASK_WITH_ID
export const WINDOW_MANAGER_EXPORT_TASK_WITH_ID = windowManagerEventConstants.EXPORT_TASK_WITH_ID
export const WINDOW_MANAGER_EXPORT_CURRENT_TASK = windowManagerEventConstants.EXPORT_CURRENT_TASK
export const WINDOW_MANAGER_DELETE_MULTIPLE_TASKS_WITH_IDS = windowManagerEventConstants.DELETE_MULTIPLE_TASKS

export type WindowManagerEventKey = (typeof windowManagerEventConstants)[keyof typeof windowManagerEventConstants]
