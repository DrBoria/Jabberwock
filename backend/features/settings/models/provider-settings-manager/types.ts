import { z } from "zod"

import { providerSettingsWithIdSchema, type ProviderName } from "@jabberwock/types"

// Type-safe model migrations mapping
export type ModelMigrations = {
	[K in ProviderName]?: Record<string, string>
}

export const MODEL_MIGRATIONS: ModelMigrations = {
	jabberwock: {
		"jabberwock/code-supernova": "jabberwock/code-supernova-1-million",
	},
} as const satisfies ModelMigrations

export interface SyncCloudProfilesResult {
	hasChanges: boolean
	activeProfileChanged: boolean
	activeProfileId: string
}

export interface SyncContext {
	changedProfiles: string[]
	existingNames: Set<string>
	activeProfileChanged: boolean
	activeProfileId: string
}

export const providerProfilesSchema = z.object({
	currentApiConfigName: z.string(),
	apiConfigs: z.record(z.string(), providerSettingsWithIdSchema),
	modeApiConfigs: z.record(z.string(), z.string()).optional(),
	cloudProfileIds: z.array(z.string()).optional(),
	migrations: z
		.object({
			rateLimitSecondsMigrated: z.boolean().optional(),
			openAiHeadersMigrated: z.boolean().optional(),
			consecutiveMistakeLimitMigrated: z.boolean().optional(),
			todoListEnabledMigrated: z.boolean().optional(),
			claudeCodeLegacySettingsMigrated: z.boolean().optional(),
		})
		.optional(),
})

export type ProviderProfiles = z.infer<typeof providerProfilesSchema>

export type MigrationFlag = keyof NonNullable<ProviderProfiles["migrations"]>

export interface MigrationStep {
	flag: MigrationFlag
	migrate: () => Promise<void>
}

export interface ProviderSettingsDeps {
	lock: <T>(cb: () => Promise<T>) => Promise<T>
	load: () => Promise<ProviderProfiles>
	store: (profiles: ProviderProfiles) => Promise<void>
	generateId: () => string
}
