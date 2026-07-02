import { ExtensionContext } from "vscode"

import { DEFAULT_CONSECUTIVE_MISTAKE_LIMIT } from "@jabberwock/types"

import {
	type ProviderProfiles,
	type MigrationFlag,
} from "@features/settings/models/provider-settings-manager/ProviderSettingsManager-types"

export async function migrateRateLimitSeconds(
	context: ExtensionContext,
	providerProfiles: ProviderProfiles,
): Promise<void> {
	try {
		let rateLimitSeconds: number | undefined

		try {
			rateLimitSeconds = await context.globalState.get<number>("rateLimitSeconds")
		} catch (error) {
			console.error("[jabberwock] [MigrateRateLimitSeconds] Error getting global rate limit:", error)
		}

		if (rateLimitSeconds === undefined) {
			rateLimitSeconds = 0
		}

		for (const [_name, apiConfig] of Object.entries(providerProfiles.apiConfigs)) {
			if (apiConfig.rateLimitSeconds === undefined) {
				apiConfig.rateLimitSeconds = rateLimitSeconds
			}
		}
	} catch (error) {
		console.error(`[jabberwock] [MigrateRateLimitSeconds] Failed to migrate rate limit settings:`, error)
	}
}

export async function migrateOpenAiHeaders(providerProfiles: ProviderProfiles): Promise<void> {
	try {
		for (const [_name, apiConfig] of Object.entries(providerProfiles.apiConfigs)) {
			const configAny = apiConfig as { [key: string]: unknown }

			const configRecord = configAny as { [key: string]: unknown }
			if (
				configRecord.openAiHostHeader &&
				(!apiConfig.openAiHeaders || Object.keys(apiConfig.openAiHeaders || {}).length === 0)
			) {
				apiConfig.openAiHeaders = { Host: configRecord.openAiHostHeader as string }

				delete configRecord.openAiHostHeader
			}
		}
	} catch (error) {
		console.error(`[jabberwock] [MigrateOpenAiHeaders] Failed to migrate OpenAI headers:`, error)
	}
}

export async function migrateConsecutiveMistakeLimit(providerProfiles: ProviderProfiles): Promise<void> {
	try {
		for (const [name, apiConfig] of Object.entries(providerProfiles.apiConfigs)) {
			if (apiConfig.consecutiveMistakeLimit == null) {
				apiConfig.consecutiveMistakeLimit = DEFAULT_CONSECUTIVE_MISTAKE_LIMIT
			}
		}
	} catch (error) {
		console.error(
			`[jabberwock] [MigrateConsecutiveMistakeLimit] Failed to migrate consecutive mistake limit:`,
			error,
		)
	}
}

export async function migrateTodoListEnabled(providerProfiles: ProviderProfiles): Promise<void> {
	try {
		for (const [_name, apiConfig] of Object.entries(providerProfiles.apiConfigs)) {
			if (apiConfig.todoListEnabled === undefined) {
				apiConfig.todoListEnabled = true
			}
		}
	} catch (error) {
		console.error(`[jabberwock] [MigrateTodoListEnabled] Failed to migrate todo list enabled setting:`, error)
	}
}

export async function migrateClaudeCodeLegacySettings(providerProfiles: ProviderProfiles): Promise<void> {
	for (const apiConfig of Object.values(providerProfiles.apiConfigs)) {
		if ((apiConfig.apiProvider as string) !== "claude-code") continue

		const config = apiConfig as { [key: string]: unknown }
		if ("claudeCodePath" in config) {
			delete config.claudeCodePath
		}
		if ("claudeCodeMaxOutputTokens" in config) {
			delete config.claudeCodeMaxOutputTokens
		}
	}
}

export function buildMigrationPlan(
	providerProfiles: ProviderProfiles,
	context: ExtensionContext,
): { flag: MigrationFlag; migrate: () => Promise<void> }[] {
	return [
		{
			flag: "rateLimitSecondsMigrated" as MigrationFlag,
			migrate: () => migrateRateLimitSeconds(context, providerProfiles),
		},
		{ flag: "openAiHeadersMigrated" as MigrationFlag, migrate: () => migrateOpenAiHeaders(providerProfiles) },
		{
			flag: "consecutiveMistakeLimitMigrated" as MigrationFlag,
			migrate: () => migrateConsecutiveMistakeLimit(providerProfiles),
		},
		{ flag: "todoListEnabledMigrated" as MigrationFlag, migrate: () => migrateTodoListEnabled(providerProfiles) },
		{
			flag: "claudeCodeLegacySettingsMigrated" as MigrationFlag,
			migrate: () => migrateClaudeCodeLegacySettings(providerProfiles),
		},
	]
}
