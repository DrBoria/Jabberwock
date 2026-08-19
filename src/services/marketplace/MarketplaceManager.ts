import * as vscode from "vscode"

import type { MarketplaceItem, MarketplaceItemType } from "@jabberwock/types"

import { RemoteConfigLoader } from "./RemoteConfigLoader"
import { SimpleInstaller } from "./SimpleInstaller"
import { loadOrgSettings, processOrgItems } from "./org-utils"
import {
	installMarketplaceItem as performInstall,
	removeInstalledMarketplaceItem as performRemove,
} from "./installation-operations"
import { getInstallationMetadata as fetchInstallationMeta } from "./installation-meta"
import type { MarketplaceItemsResponse } from "./types"

export class MarketplaceManager {
	private configLoader: RemoteConfigLoader
	private installer: SimpleInstaller

	constructor(private readonly context: vscode.ExtensionContext) {
		this.configLoader = new RemoteConfigLoader()
		this.installer = new SimpleInstaller(context)
	}

	async getMarketplaceItems(): Promise<MarketplaceItemsResponse> {
		try {
			const { orgSettings, errors } = loadOrgSettings()
			const allMarketplaceItems = await this.configLoader.loadAllItems(orgSettings?.hideMarketplaceMcps)
			const { organizationMcps, marketplaceItems } = processOrgItems(orgSettings, allMarketplaceItems)

			return {
				organizationMcps,
				marketplaceItems,
				errors: errors.length > 0 ? errors : undefined,
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.error("[jabberwock] Failed to load marketplace items:", error)

			return {
				organizationMcps: [],
				marketplaceItems: [],
				errors: [errorMessage],
			}
		}
	}

	async getCurrentItems(): Promise<MarketplaceItem[]> {
		const result = await this.getMarketplaceItems()
		return [...result.organizationMcps, ...result.marketplaceItems]
	}

	filterItems(
		items: MarketplaceItem[],
		filters: { type?: MarketplaceItemType; search?: string; tags?: string[] },
	): MarketplaceItem[] {
		return items.filter((item) => {
			if (filters.type && item.type !== filters.type) {
				return false
			}

			if (filters.search) {
				const searchTerm = filters.search.toLowerCase()
				const searchableText = `${item.name} ${item.description}`.toLowerCase()
				if (!searchableText.includes(searchTerm)) {
					return false
				}
			}

			if (filters.tags?.length) {
				if (!item.tags?.some((tag) => filters.tags!.includes(tag))) {
					return false
				}
			}

			return true
		})
	}

	async updateWithFilteredItems(filters: {
		type?: MarketplaceItemType
		search?: string
		tags?: string[]
	}): Promise<MarketplaceItem[]> {
		const allItems = await this.getCurrentItems()

		if (!filters.type && !filters.search && (!filters.tags || filters.tags.length === 0)) {
			return allItems
		}

		return this.filterItems(allItems, filters)
	}

	async installMarketplaceItem(
		item: MarketplaceItem,
		options?: { target?: "global" | "project"; parameters?: { [key: string]: unknown } },
	): Promise<string> {
		return performInstall(item, this.installer, options)
	}

	async removeInstalledMarketplaceItem(
		item: MarketplaceItem,
		options?: { target?: "global" | "project" },
	): Promise<void> {
		return performRemove(item, this.installer, options)
	}

	async cleanup(): Promise<void> {
		this.configLoader.clearCache()
	}

	async getInstallationMetadata(): Promise<{
		project: Record<string, { type: string }>
		global: Record<string, { type: string }>
	}> {
		return fetchInstallationMeta(this.context)
	}
}
