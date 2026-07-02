import type { ProviderSettings } from "@jabberwock/types"

export function syncModelIdEffect(
	isRetiredSelectedProvider: boolean,
	selectedModelId: string | undefined,
	apiModelId: string | undefined,
	setApiConfigurationField: <K extends keyof ProviderSettings>(
		field: K,
		value: ProviderSettings[K],
		isUserAction?: boolean,
	) => void,
): void {
	if (isRetiredSelectedProvider) return
	if (selectedModelId && apiModelId !== selectedModelId) {
		setApiConfigurationField("apiModelId", selectedModelId, false)
	}
}
