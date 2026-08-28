// v4 B2 (L14): structural host-context view instead of the vscode type.
import type { IExtensionContextView } from "@features/foundation/vscode/context"

import { type ProviderName } from "@jabberwock/types"

import { modes } from "@shared/modes"

import {
	MODEL_MIGRATIONS,
	type ProviderProfiles,
} from "@features/settings/models/provider-settings-manager/ProviderSettingsManager-types"
import { buildMigrationPlan } from "./ProviderSettingsManager-migrations"

export function getSeedId(providerProfiles: ProviderProfiles, defaultConfigId: string): string {
	const currentName = providerProfiles.currentApiConfigName
	const currentConfig = providerProfiles.apiConfigs[currentName]
	if (currentConfig?.id) {
		return currentConfig.id
	}
	const firstConfig = Object.values(providerProfiles.apiConfigs)[0]
	if (firstConfig?.id) {
		return firstConfig.id
	}
	return defaultConfigId
}

export function applyModelMigrations(providerProfiles: ProviderProfiles): boolean {
	let migrated = false

	try {
		for (const [_name, apiConfig] of Object.entries(providerProfiles.apiConfigs)) {
			if (!apiConfig.apiProvider || !apiConfig.apiModelId) {
				continue
			}

			const provider = apiConfig.apiProvider as ProviderName
			const providerMigrations = MODEL_MIGRATIONS[provider]
			if (!providerMigrations) {
				continue
			}

			const newModelId = providerMigrations[apiConfig.apiModelId]
			if (newModelId && newModelId !== apiConfig.apiModelId) {
				console.log(
					`[ModelMigration] Migrating ${apiConfig.apiProvider} model from ${apiConfig.apiModelId} to ${newModelId}`,
				)
				apiConfig.apiModelId = newModelId
				migrated = true
			}
		}
	} catch (error) {
		console.error(`[jabberwock] [ModelMigration] Failed to apply model migrations:`, error)
	}

	return migrated
}

export function cleanModelId(modelId: string | undefined): string | undefined {
	if (!modelId) return undefined

	if (modelId.includes("/")) {
		return modelId.split("/").pop()
	}

	return modelId
}

export async function initializeCore(
	context: IExtensionContextView,
	load: () => Promise<ProviderProfiles | null>,
	store: (profiles: ProviderProfiles) => Promise<void>,
	generateId: () => string,
	defaultProviderProfiles: ProviderProfiles,
): Promise<void> {
	const providerProfiles = await load()

	if (!providerProfiles) {
		await store(defaultProviderProfiles)
		return
	}

	let isDirty = false

	if (!providerProfiles.modeApiConfigs) {
		const seedId = getSeedId(providerProfiles, generateId())
		providerProfiles.modeApiConfigs = Object.fromEntries(modes.map((m) => [m.slug, seedId]))
		isDirty = true
	}

	if (applyModelMigrations(providerProfiles)) {
		isDirty = true
	}

	for (const apiConfig of Object.values(providerProfiles.apiConfigs)) {
		if (!apiConfig.id) {
			apiConfig.id = generateId()
			isDirty = true
		}
	}

	if (!providerProfiles.migrations) {
		providerProfiles.migrations = {
			rateLimitSecondsMigrated: false,
			openAiHeadersMigrated: false,
			consecutiveMistakeLimitMigrated: false,
			todoListEnabledMigrated: false,
			claudeCodeLegacySettingsMigrated: false,
		}
		isDirty = true
	}

	const migrationPlan = buildMigrationPlan(providerProfiles, context)

	for (const step of migrationPlan) {
		const flag = providerProfiles.migrations[step.flag]
		if (!flag) {
			await step.migrate()
			providerProfiles.migrations[step.flag] = true
			isDirty = true
		}
	}

	if (isDirty) {
		await store(providerProfiles)
	}
}
