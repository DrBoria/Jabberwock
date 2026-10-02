import { useCallback } from "react"

import type { ProviderSettings } from "@jabberwock/types"

import { inputEventTransform } from "@src/features/settings/components/shared/transforms"

type SetApiConfigurationField = (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void

/**
 * Shared input handler for provider settings forms. Returns a `useCallback`
 * that, given a field and an optional transform, produces an event handler
 * that writes the transformed (or raw text) value to the api configuration.
 *
 * Extracted from the ~20 provider form components that each copied the same
 * `handleInputChange` closure — the logic now lives in one place.
 */
export function useHandleInputChange(setApiConfigurationField: SetApiConfigurationField) {
	return useCallback(
		<K extends keyof ProviderSettings, E>(field: K, transform?: (event: E) => ProviderSettings[K]) =>
			(event: E | Event) => {
				setApiConfigurationField(
					field,
					transform
						? transform(event as E)
						: (inputEventTransform(event as { target: HTMLInputElement }) as ProviderSettings[K]),
				)
			},
		[setApiConfigurationField],
	)
}
