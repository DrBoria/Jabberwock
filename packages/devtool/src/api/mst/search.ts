import type { BackendStore, FrontendBridge } from "./types.js"

export interface SearchParams {
	env: "backend" | "frontend"
	query: string
	store?: string
	limit?: number
	cursor?: number
}

interface SearchResult {
	path: string
	value: string
}

export async function searchBackendState(
	params: SearchParams,
	backendStore: BackendStore | undefined,
): Promise<string> {
	if (!backendStore) {
		return JSON.stringify({ error: "Backend store not available" })
	}
	const mstStore = backendStore.getMstStore()
	if (!mstStore) {
		return JSON.stringify({ error: "MST store not available" })
	}

	const rootStore = params.store ? (mstStore as Record<string, unknown>)[params.store] : mstStore
	if (!rootStore) {
		return JSON.stringify({ error: `Store "${params.store}" not found` })
	}

	try {
		const results = searchSnapshot(rootStore as Record<string, unknown>, params.query.toLowerCase())
		return paginateSearchResults(results, params.limit, params.cursor)
	} catch (error) {
		return JSON.stringify({
			error: `Search failed: ${error instanceof Error ? error.message : String(error)}`,
		})
	}
}

export async function searchFrontendState(
	params: SearchParams,
	frontendBridge: FrontendBridge | undefined,
): Promise<string> {
	if (!frontendBridge) {
		return JSON.stringify({ error: "Frontend bridge not available" })
	}
	try {
		const snapshot = await frontendBridge.getRootSnapshot()
		const rootStore = params.store ? (snapshot as Record<string, unknown>)[params.store] : snapshot
		if (!rootStore) {
			return JSON.stringify({ error: `Store "${params.store}" not found` })
		}
		const results = searchSnapshot(rootStore as Record<string, unknown>, params.query.toLowerCase())
		return paginateSearchResults(results, params.limit, params.cursor)
	} catch (err) {
		return JSON.stringify({ error: `Failed to search frontend state: ${(err as Error).message}` })
	}
}

/**
 * Paginate search results in reverse order (newest match first) with cursor-based pagination.
 */
function paginateSearchResults(results: SearchResult[] | undefined, limit = 10, cursor = 0): string {
	if (!results || !Array.isArray(results)) {
		return JSON.stringify({ results: [], totalResults: 0, error: "No results to paginate" })
	}
	const totalResults = results.length
	const endIndex = results.length - cursor
	const startIndex = Math.max(0, endIndex - limit)
	const paginated = results.slice(startIndex, endIndex).reverse()
	return JSON.stringify({ results: paginated, totalResults })
}

function searchSnapshot(obj: Record<string, unknown>, query: string, maxDepth = 10, maxResults = 1000): SearchResult[] {
	const results: SearchResult[] = []

	function traverse(obj: unknown, currentPath: string, depth: number): void {
		if (obj === null || obj === undefined) {
			return
		}
		if (depth > maxDepth) {
			return
		}
		if (results.length >= maxResults) {
			return
		}
		if (typeof obj === "object" && !Array.isArray(obj)) {
			for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
				if (results.length >= maxResults) {
					return
				}
				const newPath = currentPath ? `${currentPath}.${key}` : key
				if (key.toLowerCase().includes(query)) {
					const rawVal = typeof value === "string" ? value : JSON.stringify(value)
					const val = rawVal ?? "null"
					results.push({ path: newPath, value: val.length > 200 ? val.slice(0, 200) + "..." : val })
				}
				traverse(value, newPath, depth + 1)
			}
		} else if (Array.isArray(obj)) {
			obj.forEach((item, index) => {
				if (results.length >= maxResults) {
					return
				}
				const newPath = `${currentPath}[${index}]`
				traverse(item, newPath, depth + 1)
			})
		} else if (typeof obj === "string" && obj.toLowerCase().includes(query)) {
			results.push({ path: currentPath, value: obj.length > 200 ? obj.slice(0, 200) + "..." : obj })
		}
	}

	traverse(obj, "", 0)
	return results
}
