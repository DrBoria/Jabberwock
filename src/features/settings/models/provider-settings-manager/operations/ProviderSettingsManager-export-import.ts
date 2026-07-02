import { discriminatedProviderSettingsWithIdSchema, isRetiredProvider } from "@jabberwock/types"

import { buildApiHandler } from "@api"

import {
	providerProfilesSchema,
	type ProviderProfiles,
	type ProviderSettingsDeps,
} from "@features/settings/models/provider-settings-manager/ProviderSettingsManager-types"

export async function exportProviderProfiles(
	deps: Pick<ProviderSettingsDeps, "lock" | "load">,
): Promise<ProviderProfiles> {
	try {
		return await deps.lock(async () => {
			const profiles = providerProfilesSchema.parse(await deps.load())
			const configs = profiles.apiConfigs
			for (const name in configs) {
				const apiProvider = configs[name].apiProvider

				if (typeof apiProvider === "string" && isRetiredProvider(apiProvider)) {
					continue
				}

				configs[name] = discriminatedProviderSettingsWithIdSchema.parse(configs[name])

				if (!configs[name].apiProvider) {
					continue
				}

				try {
					const apiHandler = buildApiHandler(configs[name])
					const modelInfo = apiHandler.getModel().info

					const supportsReasoningBudget =
						modelInfo.supportsReasoningBudget || modelInfo.requiredReasoningBudget

					if (!supportsReasoningBudget) {
						delete configs[name].modelMaxTokens
						delete configs[name].modelMaxThinkingTokens
					}
				} catch (error) {
					console.warn(`[jabberwock] Skipping token field filtering for config '${name}': ${error}`)
				}
			}
			return profiles
		})
	} catch (error) {
		throw new Error(`Failed to export provider profiles: ${error}`)
	}
}

export async function importProviderProfiles(
	providerProfiles: ProviderProfiles,
	deps: Pick<ProviderSettingsDeps, "lock" | "store">,
): Promise<void> {
	try {
		return await deps.lock(() => deps.store(providerProfiles))
	} catch (error) {
		throw new Error(`Failed to import provider profiles: ${error}`)
	}
}
