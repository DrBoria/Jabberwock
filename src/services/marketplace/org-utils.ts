import type { OrganizationSettings, MarketplaceItem, McpMarketplaceItem } from "@jabberwock/types"
import { getCloudService, hasCloudService } from "@jabberwock/cloud"

export function loadOrgSettings(): { orgSettings: OrganizationSettings | undefined; errors: string[] } {
	const errors: string[] = []
	let orgSettings: OrganizationSettings | undefined

	try {
		if (hasCloudService() && getCloudService().isAuthenticated()) {
			orgSettings = getCloudService().getOrganizationSettings()
		}
	} catch (orgError) {
		console.warn("[jabberwock] Failed to load organization settings:", orgError)
		const orgErrorMessage = orgError instanceof Error ? orgError.message : String(orgError)
		errors.push(`Organization settings: ${orgErrorMessage}`)
	}

	return { orgSettings, errors }
}

export function processOrgItems(
	orgSettings: OrganizationSettings | undefined,
	allMarketplaceItems: MarketplaceItem[],
): { organizationMcps: MarketplaceItem[]; marketplaceItems: MarketplaceItem[] } {
	let organizationMcps: MarketplaceItem[] = []
	let marketplaceItems = allMarketplaceItems

	if (orgSettings) {
		if (orgSettings.mcps && orgSettings.mcps.length > 0) {
			organizationMcps = orgSettings.mcps.map(
				(mcp: McpMarketplaceItem): MarketplaceItem => ({
					...mcp,
					type: "mcp" as const,
				}),
			)
		}

		if (orgSettings.hiddenMcps && orgSettings.hiddenMcps.length > 0) {
			const hiddenMcpIds = new Set(orgSettings.hiddenMcps)
			marketplaceItems = allMarketplaceItems.filter((item) => item.type !== "mcp" || !hiddenMcpIds.has(item.id))
		}
	}

	return { organizationMcps, marketplaceItems }
}
