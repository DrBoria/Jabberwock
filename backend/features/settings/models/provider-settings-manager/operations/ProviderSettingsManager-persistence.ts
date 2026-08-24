import { type SecretStorage } from "vscode"
import { z, ZodError } from "zod"

import { providerSettingsWithIdSchema, isProviderName, isRetiredProvider } from "@jabberwock/types"
import { getTelemetryService } from "@jabberwock/telemetry"

import {
	type ProviderProfiles,
	providerProfilesSchema,
} from "@features/settings/models/provider-settings-manager/ProviderSettingsManager-types"

const SCOPE_PREFIX = "jabberwock_persistent_config_"
const LEGACY_SCOPE_PREFIX = "roo_cline_config_"

export function secretsKey(): string {
	return `${SCOPE_PREFIX}api_config`
}

export function sanitizeProviderConfig(apiConfig: unknown): unknown {
	if (typeof apiConfig !== "object" || apiConfig === null) {
		return apiConfig
	}

	const config = apiConfig as { [key: string]: unknown }

	const apiProvider = config.apiProvider

	if (
		apiProvider !== undefined &&
		(typeof apiProvider !== "string" || (!isProviderName(apiProvider) && !isRetiredProvider(apiProvider)))
	) {
		console.log(
			`[ProviderSettingsManager] Sanitizing unknown provider "${config.apiProvider}" - resetting to undefined`,
		)
		const { apiProvider: _, ...restConfig } = config
		return restConfig
	}

	return apiConfig
}

export async function loadProviderProfiles(
	secrets: SecretStorage,
	defaultProviderProfiles: ProviderProfiles,
): Promise<ProviderProfiles> {
	try {
		let content = await secrets.get(secretsKey())

		if (!content) {
			const legacyContent = await secrets.get(`${LEGACY_SCOPE_PREFIX}api_config`)

			if (legacyContent) {
				content = legacyContent
				await secrets.store(secretsKey(), legacyContent)
				await secrets.delete(`${LEGACY_SCOPE_PREFIX}api_config`)
			}
		}

		if (!content) {
			return defaultProviderProfiles
		}

		const providerProfiles = providerProfilesSchema
			.extend({
				apiConfigs: z.record(z.string(), z.unknown()),
			})
			.parse(JSON.parse(content))

		const apiConfigs = Object.entries(providerProfiles.apiConfigs).reduce(
			(acc, [key, apiConfig]) => {
				const sanitizedConfig = sanitizeProviderConfig(apiConfig)

				const providerValue =
					typeof sanitizedConfig === "object" && sanitizedConfig !== null && "apiProvider" in sanitizedConfig
						? (sanitizedConfig as { [key: string]: unknown }).apiProvider
						: undefined
				const schema =
					typeof providerValue === "string" && isRetiredProvider(providerValue)
						? providerSettingsWithIdSchema.passthrough()
						: providerSettingsWithIdSchema
				const result = schema.safeParse(sanitizedConfig)
				return result.success ? { ...acc, [key]: result.data } : acc
			},
			{} as Record<string, import("@jabberwock/types").ProviderSettingsWithId>,
		)

		return {
			...providerProfiles,
			apiConfigs: Object.fromEntries(Object.entries(apiConfigs).filter(([_, apiConfig]) => apiConfig !== null)),
		}
	} catch (error) {
		if (error instanceof ZodError) {
			getTelemetryService().captureSchemaValidationError({
				schemaName: "ProviderProfiles",
				error,
			})
		}

		throw new Error(`Failed to read provider profiles from secrets: ${error}`)
	}
}

export async function storeProviderProfiles(secrets: SecretStorage, providerProfiles: ProviderProfiles): Promise<void> {
	try {
		await secrets.store(secretsKey(), JSON.stringify(providerProfiles, null, 2))
	} catch (error) {
		throw new Error(`Failed to write provider profiles to secrets: ${error}`)
	}
}
