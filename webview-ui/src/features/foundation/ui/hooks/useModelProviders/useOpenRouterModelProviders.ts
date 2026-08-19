import { useQuery, type UseQueryOptions } from "@tanstack/react-query"

interface OpenRouterModelProvider {
	label: string
}

const getOpenRouterProvidersForModel = async (
	modelId: string,
	baseUrl?: string,
): Promise<Record<string, OpenRouterModelProvider>> => {
	try {
		const apiUrl = baseUrl || "https://openrouter.ai/api/v1"
		const response = await fetch(`${apiUrl}/models/${modelId}/endpoints`, {
			headers: { Accept: "application/json" },
		})
		if (!response.ok) {
			console.error(`Failed to fetch OpenRouter providers for model ${modelId}:`, response.status)
			return {}
		}
		const json: { data?: { endpoints?: Array<{ provider_name: string; name: string }> } } = await response.json()
		const endpoints = json?.data?.endpoints
		if (!endpoints) return {}
		return Object.fromEntries(endpoints.map((ep) => [ep.provider_name, { label: ep.name }]))
	} catch (error) {
		console.error(`Failed to fetch OpenRouter providers for model ${modelId}:`, error)
		return {}
	}
}

type UseOpenRouterModelProvidersOptions = Omit<
	UseQueryOptions<Record<string, OpenRouterModelProvider>>,
	"queryKey" | "queryFn"
>
export const useOpenRouterModelProviders = (
	modelId?: string,
	baseUrl?: string,
	options?: UseOpenRouterModelProvidersOptions,
) => {
	const providersQuery = {
		queryKey: ["openrouter-model-providers", modelId, baseUrl] as const,
		queryFn: () => (modelId ? getOpenRouterProvidersForModel(modelId, baseUrl) : {}),
		...options,
	}
	return useQuery<Record<string, OpenRouterModelProvider>>(providersQuery)
}
