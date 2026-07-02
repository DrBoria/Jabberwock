import type { ModelInfo, OrganizationAllowList, ProviderName, ProviderSettings, RouterModels } from "@jabberwock/types"

export interface ApiOptionsProps {
	uriScheme: string | undefined
	apiConfiguration: ProviderSettings
	setApiConfigurationField: <K extends keyof ProviderSettings>(
		field: K,
		value: ProviderSettings[K],
		isUserAction?: boolean,
	) => void
	fromWelcomeView?: boolean
	errorMessage: string | undefined
	setErrorMessage: React.Dispatch<React.SetStateAction<string | undefined>>
}

export interface ProviderModelConfig {
	field: keyof ProviderSettings
	default?: string
}

export interface ProviderRenderProps {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (
		field: keyof ProviderSettings,
		value: ProviderSettings[keyof ProviderSettings],
		isUserAction?: boolean,
	) => void
	routerModels?: RouterModels
	selectedModelId: string
	uriScheme?: string | undefined
	simplifySettings?: boolean
	organizationAllowList: OrganizationAllowList
	modelValidationError?: string
	refetchRouterModels: () => void
	selectedModelInfo?: ModelInfo
	openAiCodexIsAuthenticated?: boolean
	cloudIsAuthenticated: boolean
}

export interface OpenRouterProviderRoutingProps {
	selectedProvider: string
	openRouterModelProviders?: Record<string, { label: string }>
	selectedModelId?: string
	apiConfiguration: ProviderSettings
	setApiConfigurationField: <K extends keyof ProviderSettings>(
		field: K,
		value: ProviderSettings[K],
		isUserAction?: boolean,
	) => void
	t: (key: string) => string
}

export interface ProviderHeaderSectionProps {
	t: (key: string) => string
	selectedProvider: string | undefined
	cloudIsAuthenticated: boolean
	docs: { url: string; name: string } | undefined
	providerOptions: { value: string; label: string }[]
	onProviderChange: (value: ProviderName) => void
}

export interface ModelPickerSectionProps {
	activeSelectedProvider: ProviderName | undefined
	apiConfiguration: ProviderSettings
	setApiConfigurationField: <K extends keyof ProviderSettings>(
		field: K,
		value: ProviderSettings[K],
		isUserAction?: boolean,
	) => void
	selectedProvider: string
	selectedModelId: string | undefined
	organizationAllowList: OrganizationAllowList
	modelValidationError: string | undefined
	fromWelcomeView: boolean | undefined
	t: (key: string) => string
}

export interface ExtraSettingsSectionProps {
	fromWelcomeView: boolean | undefined
	selectedProvider: string | undefined
	selectedModelId: string | undefined
	apiConfiguration: ProviderSettings
	setApiConfigurationField: <K extends keyof ProviderSettings>(
		field: K,
		value: ProviderSettings[K],
		isUserAction?: boolean,
	) => void
	selectedModelInfo: ModelInfo | undefined
}

export interface AdvancedSettingsSectionProps {
	fromWelcomeView?: boolean
	isAdvancedSettingsOpen: boolean
	setIsAdvancedSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>
	selectedModelInfo?: ModelInfo
	selectedProvider?: string
	apiConfiguration: ProviderSettings
	setApiConfigurationField: <K extends keyof ProviderSettings>(
		field: K,
		value: ProviderSettings[K],
		isUserAction?: boolean,
	) => void
	handleInputChange: <K extends keyof ProviderSettings, E>(
		field: K,
		transform?: (event: E) => ProviderSettings[K],
	) => (event: E | Event) => void
	openRouterModelProviders?: Record<string, { label: string }>
	selectedModelId?: string
	t: (key: string) => string
}
