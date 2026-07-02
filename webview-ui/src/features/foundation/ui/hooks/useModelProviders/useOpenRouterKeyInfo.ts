import { useQuery, type UseQueryOptions } from "@tanstack/react-query"

interface OpenRouterKeyInfo {
	limit?: number
	usage?: number
	key?: string
	is_free?: boolean
	rate_limit?: Record<string, unknown>
}

const getOpenRouterKeyInfo = async (apiKey?: string, baseUrl?: string): Promise<OpenRouterKeyInfo | null> => {
	try {
		const url = new URL("/api/v1/auth/key", baseUrl || "https://openrouter.ai")
		const response = await fetch(url, {
			headers: { Authorization: `Bearer ${apiKey}` },
		})
		if (!response.ok) {
			console.error("OpenRouter key info fetch failed", response.status)
			return null
		}
		const data: OpenRouterKeyInfo = await response.json()
		return data
	} catch (error) {
		console.error("OpenRouter key info fetch error", error)
		return null
	}
}

type UseOpenRouterKeyInfoOptions = Omit<UseQueryOptions<OpenRouterKeyInfo | null>, "queryKey" | "queryFn">
export const useOpenRouterKeyInfo = (apiKey?: string, baseUrl?: string, options?: UseOpenRouterKeyInfoOptions) => {
	const keyInfoQuery = {
		queryKey: ["openrouter-key-info", apiKey, baseUrl] as const,
		queryFn: () => getOpenRouterKeyInfo(apiKey, baseUrl),
		staleTime: 30 * 1000,
		enabled: !!apiKey,
		...options,
	}
	return useQuery<OpenRouterKeyInfo | null>(keyInfoQuery)
}
