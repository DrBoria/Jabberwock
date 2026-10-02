import axios from "axios"
import * as yaml from "yaml"
import { z } from "zod"

import {
	type MarketplaceItem,
	type MarketplaceItemType,
	modeMarketplaceItemSchema,
	mcpMarketplaceItemSchema,
} from "@jabberwock/types"
import { getJabberwockApiUrl } from "@jabberwock/cloud"

const modeMarketplaceResponse = z.object({
	items: z.array(modeMarketplaceItemSchema),
})

const mcpMarketplaceResponse = z.object({
	items: z.array(mcpMarketplaceItemSchema),
})

/**
 * RemoteConfigLoader — loads marketplace items from the Jabberwock API
 * with a short-lived in-memory cache.
 */
export function RemoteConfigLoader() {
	const apiBaseUrl = getJabberwockApiUrl()
	const cache = new Map<string, { data: MarketplaceItem[]; timestamp: number }>()
	const cacheDuration = 5 * 60 * 1000 // 5 minutes

	function getFromCache(key: string): MarketplaceItem[] | null {
		const cached = cache.get(key)
		if (!cached) return null

		const now = Date.now()
		if (now - cached.timestamp > cacheDuration) {
			cache.delete(key)
			return null
		}

		return cached.data
	}

	function setCache(key: string, data: MarketplaceItem[]): void {
		cache.set(key, {
			data,
			timestamp: Date.now(),
		})
	}

	async function fetchWithRetry<T>(url: string, maxRetries = 3): Promise<T> {
		let lastError: Error

		for (let i = 0; i < maxRetries; i++) {
			try {
				const response = await axios.get(url, {
					timeout: 10000, // 10 second timeout
					headers: {
						Accept: "application/json",
						"Content-Type": "application/json",
					},
				})
				return response.data as T
			} catch (error) {
				lastError = error as Error
				if (i < maxRetries - 1) {
					// Exponential backoff: 1s, 2s, 4s
					const delay = Math.pow(2, i) * 1000
					await new Promise((resolve) => setTimeout(resolve, delay))
				}
			}
		}

		throw lastError!
	}

	async function fetchModes(): Promise<MarketplaceItem[]> {
		const cacheKey = "modes"
		const cached = getFromCache(cacheKey)

		if (cached) {
			return cached
		}

		const data = await fetchWithRetry<string>(`${apiBaseUrl}/api/marketplace/modes`)

		const yamlData = yaml.parse(data)
		const validated = modeMarketplaceResponse.parse(yamlData)

		const items: MarketplaceItem[] = validated.items.map((item) => ({
			type: "mode" as const,
			...item,
		}))

		setCache(cacheKey, items)
		return items
	}

	async function fetchMcps(): Promise<MarketplaceItem[]> {
		const cacheKey = "mcps"
		const cached = getFromCache(cacheKey)

		if (cached) {
			return cached
		}

		const data = await fetchWithRetry<string>(`${apiBaseUrl}/api/marketplace/mcps`)

		const yamlData = yaml.parse(data)
		const validated = mcpMarketplaceResponse.parse(yamlData)

		const items: MarketplaceItem[] = validated.items.map((item) => ({
			type: "mcp" as const,
			...item,
		}))

		setCache(cacheKey, items)
		return items
	}

	return {
		async loadAllItems(hideMarketplaceMcps = false): Promise<MarketplaceItem[]> {
			const items: MarketplaceItem[] = []

			const modesPromise = fetchModes()
			const mcpsPromise = hideMarketplaceMcps ? Promise.resolve([]) : fetchMcps()

			const [modes, mcps] = await Promise.all([modesPromise, mcpsPromise])

			items.push(...modes, ...mcps)
			return items
		},

		async getItem(id: string, type: MarketplaceItemType): Promise<MarketplaceItem | null> {
			const items = await this.loadAllItems()
			return items.find((item) => item.id === id && item.type === type) || null
		},

		clearCache(): void {
			cache.clear()
		},
	}
}

/** RemoteConfigLoader instance type */
export type RemoteConfigLoader = ReturnType<typeof RemoteConfigLoader>
