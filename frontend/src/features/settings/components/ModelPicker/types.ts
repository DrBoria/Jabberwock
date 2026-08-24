import type { ProviderSettings, ModelInfo, OrganizationAllowList } from "@jabberwock/types"

export type ModelIdKey = keyof Pick<
	ProviderSettings,
	| "openRouterModelId"
	| "requestyModelId"
	| "unboundModelId"
	| "openAiModelId"
	| "litellmModelId"
	| "vercelAiGatewayModelId"
	| "apiModelId"
	| "ollamaModelId"
	| "lmStudioModelId"
	| "lmStudioDraftModelId"
	| "vsCodeLmModelSelector"
>

export interface ModelPickerProps {
	defaultModelId: string
	models: Record<string, ModelInfo> | null
	modelIdKey: ModelIdKey
	serviceName: string
	serviceUrl: string
	apiConfiguration: ProviderSettings
	setApiConfigurationField: <K extends keyof ProviderSettings>(
		field: K,
		value: ProviderSettings[K],
		isUserAction?: boolean,
	) => void
	organizationAllowList?: OrganizationAllowList
	errorMessage?: string
	simplifySettings?: boolean
	hidePricing?: boolean
	label?: string
	valueTransform?: (modelId: string) => unknown
	displayTransform?: (value: unknown) => string
	onModelChange?: (modelId: string) => void
}

export interface UseModelPickerState {
	open: boolean
	setOpen: (open: boolean) => void
	searchValue: string
	setSearchValue: (value: string) => void
	isDescriptionExpanded: boolean
	setIsDescriptionExpanded: (expanded: boolean) => void
	selectedModelId: string | undefined
	selectedModelInfo: ModelInfo | undefined
	displayValue: string | undefined
	modelIds: string[]
	onSelect: (modelId: string) => void
	onOpenChange: (open: boolean) => void
	onClearSearch: () => void
}

export interface PopoverContentInnerProps {
	searchValue: string
	onClearSearch: () => void
	onSelect: (modelId: string) => void
	modelIds: string[]
	displayValue: string | undefined
	setSearchValue: (value: string) => void
}

export interface ModelInfoSectionProps {
	selectedModelId: string | undefined
	selectedModelInfo: ModelInfo | undefined
	apiConfiguration: ProviderSettings
	isDescriptionExpanded: boolean
	setIsDescriptionExpanded: (expanded: boolean) => void
	hidePricing: boolean | undefined
}
