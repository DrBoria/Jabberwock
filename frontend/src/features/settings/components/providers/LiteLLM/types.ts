import type { ProviderSettings, OrganizationAllowList } from "@jabberwock/types"

export type LiteLLMProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	organizationAllowList: OrganizationAllowList
	modelValidationError?: string
	simplifySettings?: boolean
}

export type LiteLLMFieldProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	t: (key: string) => string
}

export type LiteLLMRefreshStatus = "idle" | "loading" | "success" | "error"

export type LiteLLMRefreshButtonProps = {
	refreshStatus: LiteLLMRefreshStatus
	onRefresh: () => void
	disabled: boolean
	t: (key: string) => string
}

export type LiteLLMRefreshStatusProps = {
	refreshStatus: LiteLLMRefreshStatus
	refreshError: string | undefined
	t: (key: string) => string
}

export type LiteLLMPromptCachingProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	routerModels: { litellm?: Record<string, { supportsPromptCache?: boolean }> } | undefined
	t: (key: string) => string
}
