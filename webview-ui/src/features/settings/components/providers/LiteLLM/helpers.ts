import type { ProviderSettings } from "@jabberwock/types"
import { inputEventTransform } from "../../shared/transforms"

export const safeValue = (value: string | undefined | null, fallback = ""): string => (value == null ? fallback : value)

export const handleInputChange =
	<K extends keyof ProviderSettings, E>(
		setApiConfigurationField: (
			field: keyof ProviderSettings,
			value: ProviderSettings[keyof ProviderSettings],
		) => void,
		field: K,
		transform?: (event: E) => ProviderSettings[K],
	) =>
	(event: E | Event) => {
		setApiConfigurationField(
			field,
			transform
				? transform(event as E)
				: (inputEventTransform(event as { target: HTMLInputElement }) as ProviderSettings[K]),
		)
	}
