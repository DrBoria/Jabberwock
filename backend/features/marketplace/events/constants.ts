/**
 * Marketplace feature — event type constants.
 * These map to webview message types routed through webviewMessageHandler.
 */
export const marketplaceEventConstants = {
	FILTER_MARKETPLACE_ITEMS: "filterMarketplaceItems" as const,
	INSTALL_MARKETPLACE_ITEM: "installMarketplaceItem" as const,
	INSTALL_WITH_PARAMETERS: "installMarketplaceItemWithParameters" as const,
	REMOVE_INSTALLED_ITEM: "removeInstalledMarketplaceItem" as const,
	FETCH_MARKETPLACE_DATA: "fetchMarketplaceData" as const,
	REFRESH_CUSTOM_TOOLS: "refreshCustomTools" as const,
	CANCEL_MARKETPLACE_INSTALL: "cancelMarketplaceInstall" as const,
	MARKETPLACE_BUTTON_CLICKED: "marketplaceButtonClicked" as const,
} as const

/**
 * Monolithic-style aliases for backward compatibility with webview-mappings imports.
 */
export const MARKETPLACE_MARKETPLACE_BUTTON_CLICKED = marketplaceEventConstants.MARKETPLACE_BUTTON_CLICKED
export const MARKETPLACE_FILTER_MARKETPLACE_ITEMS = marketplaceEventConstants.FILTER_MARKETPLACE_ITEMS
export const MARKETPLACE_INSTALL_MARKETPLACE_ITEM = marketplaceEventConstants.INSTALL_MARKETPLACE_ITEM
export const MARKETPLACE_INSTALL_MARKETPLACE_ITEM_WITH_PARAMETERS = marketplaceEventConstants.INSTALL_WITH_PARAMETERS
export const MARKETPLACE_CANCEL_MARKETPLACE_INSTALL = marketplaceEventConstants.CANCEL_MARKETPLACE_INSTALL
export const MARKETPLACE_REMOVE_INSTALLED_MARKETPLACE_ITEM = marketplaceEventConstants.REMOVE_INSTALLED_ITEM
export const MARKETPLACE_FETCH_MARKETPLACE_DATA = marketplaceEventConstants.FETCH_MARKETPLACE_DATA
export const MARKETPLACE_REFRESH_CUSTOM_TOOLS = marketplaceEventConstants.REFRESH_CUSTOM_TOOLS
// Note: SKILLS constants are not in marketplaceEventConstants but in the monolithic file.
// These are still imported from @eventConstants in the webview-mappings.
// They are defined here as separate exports for local import.
export const MARKETPLACE_REQUEST_SKILLS = "requestSkills" as const
export const MARKETPLACE_CREATE_SKILL = "createSkill" as const
export const MARKETPLACE_DELETE_SKILL = "deleteSkill" as const
export const MARKETPLACE_MOVE_SKILL = "moveSkill" as const
export const MARKETPLACE_UPDATE_SKILL_MODES = "updateSkillModes" as const
export const MARKETPLACE_OPEN_SKILL_FILE = "openSkillFile" as const

export type MarketplaceEventKey = (typeof marketplaceEventConstants)[keyof typeof marketplaceEventConstants]
