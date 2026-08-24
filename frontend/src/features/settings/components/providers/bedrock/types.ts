import type { ProviderSettings, ModelInfo } from "@jabberwock/types"

export type BedrockProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	selectedModelInfo?: ModelInfo
	simplifySettings?: boolean
}

export type HandleInputChangeFn = <K extends keyof ProviderSettings, E>(
	field: K,
	transform?: (event: E) => ProviderSettings[K],
) => (event: E | Event) => void
