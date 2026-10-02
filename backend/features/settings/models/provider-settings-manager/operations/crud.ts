import {
	type ProviderSettingsWithId,
	discriminatedProviderSettingsWithIdSchema,
	providerSettingsWithIdSchema,
	isRetiredProvider,
	getModelId,
	type ProviderSettingsEntry,
} from "@jabberwock/types"

import { type Mode } from "@shared/modes"

import { cleanModelId } from "./initialize"
import { type ProviderSettingsDeps } from "@features/settings"

export async function listConfig(deps: Pick<ProviderSettingsDeps, "lock" | "load">): Promise<ProviderSettingsEntry[]> {
	try {
		return await deps.lock(async () => {
			const providerProfiles = await deps.load()

			return Object.entries(providerProfiles.apiConfigs).map(([name, apiConfig]) => ({
				name,
				id: apiConfig.id || "",
				apiProvider: apiConfig.apiProvider,
				modelId: cleanModelId(getModelId(apiConfig)),
			}))
		})
	} catch (error) {
		throw new Error(`Failed to list configs: ${error}`)
	}
}

/**
 * Normalize a config for saving. Legacy configs (and some host payloads) carry malformed
 * optional setting values that the strict ProviderSettings schema rejects —
 * e.g. reasoningEffort: "" (empty string) or verbosity: <number>.
 * Without this, saveConfig throws "Failed to save config" for any
 * profile that inherited such values (the migrateSingleConfig path on
 * webview launch, and upsertApiConfig when creating a provider), which
 * is why provider registration appeared broken. Drop empty-string
 * reasoningEffort and non-string verbosity instead of failing.
 */
function normalizeConfigForSave(config: ProviderSettingsWithId): ProviderSettingsWithId {
	// Normalize an empty-string apiProvider to "no provider" for the discriminated union.
	let normalizedConfig = config.apiProvider?.length === 0 ? { ...config, apiProvider: undefined } : config

	if (typeof normalizedConfig.reasoningEffort === "string" && normalizedConfig.reasoningEffort.trim() === "") {
		normalizedConfig = { ...normalizedConfig, reasoningEffort: undefined }
	}
	if (normalizedConfig.verbosity != null && typeof normalizedConfig.verbosity !== "string") {
		normalizedConfig = { ...normalizedConfig, verbosity: undefined }
	}
	return normalizedConfig
}

/**
 * Parse the normalized config against the strict schema. Retired providers keep their
 * legacy shape via the passthrough schema; everything else goes through the discriminated union.
 */
function parseNormalizedConfig(normalizedConfig: ProviderSettingsWithId): ProviderSettingsWithId {
	return typeof normalizedConfig.apiProvider === "string" && isRetiredProvider(normalizedConfig.apiProvider)
		? providerSettingsWithIdSchema.passthrough().parse(normalizedConfig)
		: discriminatedProviderSettingsWithIdSchema.parse(normalizedConfig)
}

export async function saveConfig(
	name: string,
	config: ProviderSettingsWithId,
	deps: Pick<ProviderSettingsDeps, "lock" | "load" | "store" | "generateId">,
): Promise<string> {
	try {
		return await deps.lock(async () => {
			const providerProfiles = await deps.load()
			const existingId = providerProfiles.apiConfigs[name]?.id
			const id = config.id || existingId || deps.generateId()

			const filteredConfig = parseNormalizedConfig(normalizeConfigForSave(config))
			providerProfiles.apiConfigs[name] = { ...filteredConfig, id }
			await deps.store(providerProfiles)
			return id
		})
	} catch (error) {
		throw new Error(`Failed to save config: ${error}`)
	}
}

export async function getProfile(
	params: { name: string } | { id: string },
	deps: Pick<ProviderSettingsDeps, "lock" | "load">,
): Promise<ProviderSettingsWithId & { name: string }> {
	try {
		return await deps.lock(async () => {
			const providerProfiles = await deps.load()
			let name: string
			let providerSettings: ProviderSettingsWithId

			if ("name" in params) {
				name = params.name

				if (!providerProfiles.apiConfigs[name]) {
					throw new Error(`Config with name '${name}' not found`)
				}

				providerSettings = providerProfiles.apiConfigs[name]
			} else {
				const id = params.id

				const entry = Object.entries(providerProfiles.apiConfigs).find(([_, apiConfig]) => apiConfig.id === id)

				if (!entry) {
					throw new Error(`Config with ID '${id}' not found`)
				}

				name = entry[0]
				providerSettings = entry[1]
			}

			return { name, ...providerSettings }
		})
	} catch (error) {
		throw new Error(`Failed to get profile: ${error instanceof Error ? error.message : error}`)
	}
}

export async function activateProfile(
	params: { name: string } | { id: string },
	deps: Pick<ProviderSettingsDeps, "lock" | "load" | "store">,
): Promise<ProviderSettingsWithId & { name: string }> {
	const { name, ...providerSettings } = await getProfile(params, deps)

	try {
		return await deps.lock(async () => {
			const providerProfiles = await deps.load()
			providerProfiles.currentApiConfigName = name
			await deps.store(providerProfiles)
			return { name, ...providerSettings }
		})
	} catch (error) {
		throw new Error(`Failed to activate profile: ${error instanceof Error ? error.message : error}`)
	}
}

export async function deleteConfig(
	name: string,
	deps: Pick<ProviderSettingsDeps, "lock" | "load" | "store">,
): Promise<void> {
	try {
		return await deps.lock(async () => {
			const providerProfiles = await deps.load()

			if (!providerProfiles.apiConfigs[name]) {
				throw new Error(`Config '${name}' not found`)
			}

			if (Object.keys(providerProfiles.apiConfigs).length === 1) {
				throw new Error(`Cannot delete the last remaining configuration`)
			}

			delete providerProfiles.apiConfigs[name]
			await deps.store(providerProfiles)
		})
	} catch (error) {
		throw new Error(`Failed to delete config: ${error}`)
	}
}

export async function hasConfig(name: string, deps: Pick<ProviderSettingsDeps, "lock" | "load">): Promise<boolean> {
	try {
		return await deps.lock(async () => {
			const providerProfiles = await deps.load()
			return name in providerProfiles.apiConfigs
		})
	} catch (error) {
		throw new Error(`Failed to check config existence: ${error}`)
	}
}

export async function setModeConfig(
	mode: Mode,
	configId: string,
	deps: Pick<ProviderSettingsDeps, "lock" | "load" | "store">,
): Promise<void> {
	try {
		return await deps.lock(async () => {
			const providerProfiles = await deps.load()
			if (!providerProfiles.modeApiConfigs) {
				providerProfiles.modeApiConfigs = {}
			}
			providerProfiles.modeApiConfigs[mode] = configId
			await deps.store(providerProfiles)
		})
	} catch (error) {
		throw new Error(`Failed to set mode config: ${error}`)
	}
}

export async function getModeConfigId(
	mode: Mode,
	deps: Pick<ProviderSettingsDeps, "lock" | "load">,
): Promise<string | undefined> {
	try {
		return await deps.lock(async () => {
			const { modeApiConfigs } = await deps.load()
			return modeApiConfigs?.[mode]
		})
	} catch (error) {
		throw new Error(`Failed to get mode config: ${error}`)
	}
}
