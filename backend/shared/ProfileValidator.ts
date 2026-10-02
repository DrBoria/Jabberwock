import type { ProviderSettings, OrganizationAllowList } from "@jabberwock/types"

export function isProfileAllowed(profile: ProviderSettings, allowList: OrganizationAllowList): boolean {
	if (allowList.allowAll) {
		return true
	}

	if (!profile.apiProvider) {
		return false
	}

	if (!isProviderAllowed(profile.apiProvider, allowList)) {
		return false
	}

	const modelId = getModelIdFromProfile(profile)

	if (!modelId) {
		return allowList.providers[profile.apiProvider]?.allowAll === true
	}

	return isModelAllowed(profile.apiProvider, modelId, allowList)
}

function isProviderAllowed(providerName: string, allowList: OrganizationAllowList): boolean {
	if (allowList.allowAll) {
		return true
	}

	return providerName in allowList.providers
}

function isModelAllowed(providerName: string, modelId: string, allowList: OrganizationAllowList): boolean {
	if (allowList.allowAll) {
		return true
	}

	const providerAllowList = allowList.providers[providerName]

	if (!providerAllowList) {
		return false
	}

	if (providerAllowList.allowAll) {
		return true
	}

	return providerAllowList.models?.includes(modelId) ?? false
}

function getModelIdFromProfile(profile: ProviderSettings): string | undefined {
	const modelIdMap: Record<string, string | undefined> = {
		openai: profile.openAiModelId,
		anthropic: profile.apiModelId,
		"openai-native": profile.apiModelId,
		bedrock: profile.apiModelId,
		vertex: profile.apiModelId,
		gemini: profile.apiModelId,
		mistral: profile.apiModelId,
		deepseek: profile.apiModelId,
		xai: profile.apiModelId,
		sambanova: profile.apiModelId,
		fireworks: profile.apiModelId,
		litellm: profile.litellmModelId,
		lmstudio: profile.lmStudioModelId,
		openrouter: profile.openRouterModelId,
		ollama: profile.ollamaModelId,
		requesty: profile.requestyModelId,
		unbound: profile.unboundModelId,
	}

	if (profile.apiProvider === "vscode-lm") {
		return profile.vsCodeLmModelSelector?.id
	}

	return profile.apiProvider ? modelIdMap[profile.apiProvider] : undefined
}
