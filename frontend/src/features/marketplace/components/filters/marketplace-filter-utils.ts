import type { MarketplaceItem, MarketplaceInstalledMetadata } from "@jabberwock/types"

export function matchesType(item: MarketplaceItem, type: string): boolean {
	return !type || item.type === type
}

export function matchesSearch(item: MarketplaceItem, searchLower: string | undefined): boolean {
	return (
		!searchLower ||
		item.name.toLowerCase().includes(searchLower) ||
		(item.description || "").toLowerCase().includes(searchLower)
	)
}

export function matchesTags(item: MarketplaceItem, tags: string[]): boolean {
	return tags.length === 0 || (item.tags?.some((tag) => tags.includes(tag)) ?? false)
}

export function matchesInstalledStatus(
	item: MarketplaceItem,
	installed: string,
	installedMetadata?: MarketplaceInstalledMetadata,
): boolean {
	if (installed === "all" || !installedMetadata) return true
	const isInstalledGlobally = !!installedMetadata.global?.[item.id]
	const isInstalledInProject = !!installedMetadata.project?.[item.id]
	const isInstalled = isInstalledGlobally || isInstalledInProject
	if (installed === "installed") return isInstalled
	if (installed === "not_installed") return !isInstalled
	return true
}

export function isFilterActive(filters: {
	type: string
	search: string
	tags: string[]
	installed: "all" | "installed" | "not_installed"
}): boolean {
	return !!(filters.type || filters.search || filters.tags.length > 0 || filters.installed !== "all")
}

export function filterItems(
	items: MarketplaceItem[],
	filters: { type: string; search: string; tags: string[]; installed: "all" | "installed" | "not_installed" },
	installedMetadata?: MarketplaceInstalledMetadata,
): MarketplaceItem[] {
	const { type, search, tags, installed } = filters
	const searchLower = search?.toLowerCase()
	return items.filter(
		(item) =>
			matchesType(item, type) &&
			matchesSearch(item, searchLower) &&
			matchesTags(item, tags) &&
			matchesInstalledStatus(item, installed, installedMetadata),
	)
}
