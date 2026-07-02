import type { ProviderSettings } from "@jabberwock/types"
import { convertHeadersToObject } from "../../utils/headers"

export function handleDebouncedHeadersChange(
	apiConfiguration: ProviderSettings,
	customHeaders: [string, string][],
	setApiConfigurationField: <K extends keyof ProviderSettings>(
		field: K,
		value: ProviderSettings[K],
		isUserAction?: boolean,
	) => void,
): void {
	const currentConfigHeaders = apiConfiguration?.openAiHeaders || {}
	const newHeadersObject = convertHeadersToObject(customHeaders)
	if (JSON.stringify(currentConfigHeaders) !== JSON.stringify(newHeadersObject)) {
		setApiConfigurationField("openAiHeaders", newHeadersObject, false)
	}
}

export function syncCustomHeaders(
	apiConfiguration: ProviderSettings,
	customHeaders: [string, string][],
	setCustomHeaders: React.Dispatch<React.SetStateAction<[string, string][]>>,
): void {
	const propHeaders = apiConfiguration?.openAiHeaders || {}
	if (JSON.stringify(customHeaders) !== JSON.stringify(Object.entries(propHeaders))) {
		setCustomHeaders(Object.entries(propHeaders))
	}
}
