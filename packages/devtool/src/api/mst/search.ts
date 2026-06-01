import type { BackendStore, FrontendBridge } from "./types.js"

export interface SearchParams {
	env: "backend" | "frontend"
	query: string
	store?: string
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

	const source = params.store ? (mstStore as Record<string, unknown>)[params.store] : mstStore
	if (!source) {
		return JSON.stringify({ error: `Store "${params.store}" not found` })
	}

	const results = searchSnapshot(source as Record<string, unknown>, params.query.toLowerCase())
	return JSON.stringify({ results, totalResults: results.length })
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
		const source = params.store ? (snapshot as Record<string, unknown>)[params.store] : snapshot
		if (!source) {
			return JSON.stringify({ error: `Store "${params.store}" not found` })
		}
		const results = searchSnapshot(source as Record<string, unknown>, params.query.toLowerCase())
		return JSON.stringify({ results, totalResults: results.length })
	} catch (err) {
		return JSON.stringify({ error: `Failed to search frontend state: ${(err as Error).message}` })
	}
}

function searchSnapshot(obj: Record<string, unknown>, query: string): SearchResult[] {
	const results: SearchResult[] = []

	function traverse(obj: unknown, currentPath: string): void {
		if (obj === null || obj === undefined) {
			return
		}
		if (typeof obj === "object" && !Array.isArray(obj)) {
			for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
				const newPath = currentPath ? `${currentPath}.${key}` : key
				if (key.toLowerCase().includes(query)) {
					const val = typeof value === "string" ? value : JSON.stringify(value)
					results.push({ path: newPath, value: val.length > 200 ? val.slice(0, 200) + "..." : val })
				}
				traverse(value, newPath)
			}
		} else if (Array.isArray(obj)) {
			obj.forEach((item, index) => {
				const newPath = `${currentPath}[${index}]`
				traverse(item, newPath)
			})
		} else if (typeof obj === "string" && obj.toLowerCase().includes(query)) {
			results.push({ path: currentPath, value: obj.length > 200 ? obj.slice(0, 200) + "..." : obj })
		}
	}

	traverse(obj, "")
	return results
}
