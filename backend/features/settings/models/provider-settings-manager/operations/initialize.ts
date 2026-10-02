// v4 B2 (L14): structural host-context view instead of the vscode type.
import type { IExtensionContextView } from "@features/foundation"

import { type ProviderName } from "@jabberwock/types"

import { modes } from "@shared/modes"

import { MODEL_MIGRATIONS, type ProviderProfiles } from "@features/settings"
import { buildMigrationPlan } from "./migrations"

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

/**
 * Ensure every profile has a unique id.
 * A profile created through the upsert path can inherit the active
 * profile's id (the form state carries it at runtime even though the
 * ProviderSettings type omits it), which produces duplicate ids that break
 * id-keyed selection, mode switching and pins. Process the current profile
 * first so it keeps its id when duplicates exist (modeApiConfigs typically
 * reference the current profile's id), and regenerate any missing or
 * duplicated ids. Returns the set of used ids and the current profile's id.
 */
function ensureUniqueProfileIds(
	providerProfiles: ProviderProfiles,
	generateId: () => string,
): { usedIds: Set<string>; currentProfileId: string | undefined; changed: boolean } {
	const currentConfigName = providerProfiles.currentApiConfigName
	const configEntries = Object.entries(providerProfiles.apiConfigs).sort((a, b) => {
		if (a[0] === currentConfigName) return -1
		if (b[0] === currentConfigName) return 1
		return 0
	})
	const usedIds = new Set<string>()
	let currentProfileId: string | undefined
	let changed = false
	for (const [name, apiConfig] of configEntries) {
		const existingId = apiConfig.id
		if (existingId && !usedIds.has(existingId)) {
			// Unique id — keep it.
			usedIds.add(existingId)
			if (name === currentConfigName) {
				currentProfileId = existingId
			}
			continue
		}
		// Missing or duplicated id — assign a fresh, collision-free one.
		let freshId = generateId()
		while (usedIds.has(freshId)) {
			freshId = generateId()
		}
		apiConfig.id = freshId
		usedIds.add(freshId)
		changed = true
		if (name === currentConfigName) {
			currentProfileId = freshId
		}
	}
	return { usedIds, currentProfileId, changed }
}

/**
 * Repoint any modeApiConfigs entry that no longer resolves to an existing
 * profile id (e.g. after the current profile received a fresh id).
 */
function repointStaleModeApiConfigs(
	providerProfiles: ProviderProfiles,
	usedIds: Set<string>,
	currentProfileId: string | undefined,
): boolean {
	if (!providerProfiles.modeApiConfigs || !currentProfileId) {
		return false
	}
	let changed = false
	for (const [mode, configId] of Object.entries(providerProfiles.modeApiConfigs)) {
		if (!usedIds.has(configId)) {
			providerProfiles.modeApiConfigs[mode] = currentProfileId
			changed = true
		}
	}
	return changed
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

	const { usedIds, currentProfileId, changed } = ensureUniqueProfileIds(providerProfiles, generateId)
	isDirty = isDirty || changed

	isDirty = isDirty || repointStaleModeApiConfigs(providerProfiles, usedIds, currentProfileId)

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
