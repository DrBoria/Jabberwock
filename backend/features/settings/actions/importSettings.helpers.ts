import fs from "fs/promises"
import { z } from "zod"
import {
	globalSettingsSchema,
	providerSettingsWithIdSchema,
	isProviderName,
	type ProviderSettingsWithId,
} from "@jabberwock/types"
import { providerProfilesSchema } from "@features/settings/models/provider-settings-manager/ProviderSettingsManager-types"

export type RawProviderProfiles = {
	currentApiConfigName?: string
	apiConfigs?: Record<string, unknown>
	modeApiConfigs?: Record<string, string>
}

export function sanitizeProviderConfig(configName: string, apiConfig: unknown): { config: unknown; warning?: string } {
	if (typeof apiConfig !== "object" || apiConfig === null) {
		return { config: apiConfig }
	}

	const config = apiConfig as { [key: string]: unknown }

	if (config.apiProvider !== undefined && !isProviderName(config.apiProvider)) {
		const invalidProvider = config.apiProvider
		const { apiProvider: _apiProvider, ...restConfig } = config
		return {
			config: restConfig,
			warning: `Profile "${configName}": Invalid provider "${invalidProvider}" was removed. Please reconfigure this profile.`,
		}
	}

	return { config: apiConfig }
}

const lenientProviderProfilesSchema = providerProfilesSchema.extend({
	apiConfigs: z.record(z.string(), z.unknown()),
})

const lenientSchema = z.object({
	providerProfiles: lenientProviderProfilesSchema,
	globalSettings: globalSettingsSchema.optional(),
})

export async function parseSettingsFile(filePath: string): Promise<{
	rawProviderProfiles: RawProviderProfiles
	globalSettings: Record<string, unknown>
}> {
	const rawData = JSON.parse(await fs.readFile(filePath, "utf-8"))
	const { providerProfiles: rawProviderProfiles, globalSettings = {} } = lenientSchema.parse(rawData)
	return { rawProviderProfiles: rawProviderProfiles as RawProviderProfiles, globalSettings }
}

export function validateApiConfigs(rawProviderProfiles: RawProviderProfiles): {
	validApiConfigs: Record<string, ProviderSettingsWithId>
	warnings: string[]
} {
	const warnings: string[] = []
	const validApiConfigs: Record<string, ProviderSettingsWithId> = {}

	for (const [configName, rawConfig] of Object.entries(rawProviderProfiles.apiConfigs ?? {})) {
		const { config: sanitizedConfig, warning } = sanitizeProviderConfig(configName, rawConfig)
		if (warning) {
			warnings.push(warning)
		}

		const result = providerSettingsWithIdSchema.safeParse(sanitizedConfig)
		if (result.success) {
			validApiConfigs[configName] = result.data
		} else {
			const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")
			warnings.push(`Profile "${configName}" was skipped: ${issues}`)
		}
	}

	return { validApiConfigs, warnings }
}

export function resolveCurrentApiConfig(
	rawProviderProfiles: RawProviderProfiles,
	validApiConfigs: Record<string, ProviderSettingsWithId>,
	previousName: string | undefined,
): string {
	const validProfileNames = Object.keys(validApiConfigs)

	if (validApiConfigs[rawProviderProfiles.currentApiConfigName ?? ""]) {
		return rawProviderProfiles.currentApiConfigName ?? ""
	}

	if (validProfileNames.length > 0) {
		return validProfileNames[0]
	}

	return previousName ?? ""
}
