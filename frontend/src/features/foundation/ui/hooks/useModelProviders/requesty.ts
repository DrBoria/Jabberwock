import { useQuery, type UseQueryOptions } from "@tanstack/react-query"

interface RequestyKeyInfo {
	org_balance?: string
	credits?: number
	usage?: number
	total?: number
}

const getRequestyKeyInfo = async (baseUrl?: string, apiKey?: string): Promise<RequestyKeyInfo | null> => {
	try {
		const serviceUrl = baseUrl || "https://api.requesty.ai"
		const url = new URL("/api/v1/credits", serviceUrl)
		const response = await fetch(url, {
			headers: { Authorization: `Bearer ${apiKey}` },
		})
		if (!response.ok) {
			console.error("Requesty key info fetch failed", response.status)
			return null
		}
		const data: RequestyKeyInfo = await response.json()
		return data
	} catch (error) {
		console.error("Requesty key info fetch error", error)
		return null
	}
}

type UseRequestyKeyInfoOptions = Omit<UseQueryOptions<RequestyKeyInfo | null>, "queryKey" | "queryFn">
export const useRequestyKeyInfo = (baseUrl?: string, apiKey?: string, options?: UseRequestyKeyInfoOptions) => {
	const keyInfoQuery = {
		queryKey: ["requesty-key-info", baseUrl, apiKey] as const,
		queryFn: () => getRequestyKeyInfo(baseUrl, apiKey),
		staleTime: 30 * 1000,
		enabled: !!apiKey,
		...options,
	}
	return useQuery<RequestyKeyInfo | null>(keyInfoQuery)
}
