import { ZodError } from "zod"

import {
	PROVIDER_SETTINGS_KEYS,
	GLOBAL_SETTINGS_KEYS,
	SECRET_STATE_KEYS,
	GLOBAL_SECRET_KEYS,
	type ProviderSettings,
	type GlobalSettings,
	type SecretState,
	type GlobalState,
	type JabberwockSettings,
	providerSettingsSchema,
	globalSettingsSchema,
	isSecretStateKey,
	isProviderName,
	isRetiredProvider,
} from "@jabberwock/types"
import { getTelemetryService } from "@jabberwock/telemetry"

import { logger } from "@utils/logging"
import { getVscodeContext } from "@features/foundation/vscode/context"

// ─── Type helpers ───────────────────────────────────────────────────────

type GlobalStateKey = keyof GlobalState
type SecretStateKey = keyof SecretState
type JabberwockSettingsKey = keyof JabberwockSettings

// ─── Internal helpers ───────────────────────────────────────────────────

const globalSettingsExportSchema = globalSettingsSchema.omit({
	taskHistory: true,
	listApiConfigMeta: true,
	currentApiConfigName: true,
})

function getAllValues(): JabberwockSettings {
	const ctx = getVscodeContext()

	const globalEntries = GLOBAL_SETTINGS_KEYS.map((key) => [key, ctx.getGlobalState(key as GlobalStateKey)])
	const providerEntries = PROVIDER_SETTINGS_KEYS.filter((key) => !isSecretStateKey(key)).map((key) => [
		key,
		ctx.getGlobalState(key as GlobalStateKey),
	])

	const secretEntries = [
		...SECRET_STATE_KEYS.map((key) => [key, ctx.getSecret(key as SecretStateKey)]),
		...GLOBAL_SECRET_KEYS.map((key) => [key, ctx.getSecret(key as SecretStateKey)]),
	]

	return {
		...Object.fromEntries(globalEntries),
		...Object.fromEntries(providerEntries),
		...Object.fromEntries(secretEntries),
	} as JabberwockSettings
}

function sanitizeProviderValues(values: JabberwockSettings): JabberwockSettings {
	const legacyKeys = ["claudeCodePath", "claudeCodeMaxOutputTokens"] as const

	let sanitizedValues = values
	for (const key of legacyKeys) {
		if (key in sanitizedValues) {
			const copy = { ...sanitizedValues } as { [key: string]: unknown }
			delete copy[key as string]
			sanitizedValues = copy as JabberwockSettings
		}
	}

	const isKnownProvider =
		typeof values.apiProvider === "string" &&
		(isProviderName(values.apiProvider) || isRetiredProvider(values.apiProvider))

	if (values.apiProvider !== undefined && !isKnownProvider) {
		logger.info(`[SettingsAccess] Sanitizing invalid provider "${values.apiProvider}" - resetting to undefined`)
		const { apiProvider: _, ...restValues } = sanitizedValues
		return restValues as JabberwockSettings
	}
	return sanitizedValues
}

// ─── Public API ─────────────────────────────────────────────────────────

export interface SettingsAccess {
	/** Get all settings (global state + secrets) */
	getValues(): JabberwockSettings
	/** Get a single setting value by key */
	getValue<K extends JabberwockSettingsKey>(key: K): JabberwockSettings[K]
	/** Set a single setting value by key (dispatches to globalState or secrets) */
	setValue<K extends JabberwockSettingsKey>(key: K, value: JabberwockSettings[K]): Promise<void>
	/** Set multiple values at once */
	setValues(values: JabberwockSettings): Promise<void>

	/** Get global settings with schema validation */
	getGlobalSettings(): GlobalSettings
	/** Get provider settings with schema validation */
	getProviderSettings(): ProviderSettings
	/** Set provider settings */
	setProviderSettings(values: ProviderSettings): Promise<void>

	/** Export settings (for import/export feature) */
	export(): Promise<GlobalSettings | undefined>
	/** Reset all state */
	resetAllState(): Promise<void>
}

export function getSettingsAccess(): SettingsAccess {
	return {
		getValues(): JabberwockSettings {
			return getAllValues()
		},

		getValue<K extends JabberwockSettingsKey>(key: K): JabberwockSettings[K] {
			const ctx = getVscodeContext()
			return isSecretStateKey(key as string)
				? (ctx.getSecret(key as SecretStateKey) as JabberwockSettings[K])
				: (ctx.getGlobalState(key as GlobalStateKey) as JabberwockSettings[K])
		},

		async setValue<K extends JabberwockSettingsKey>(key: K, value: JabberwockSettings[K]): Promise<void> {
			const ctx = getVscodeContext()
			if (isSecretStateKey(key as string)) {
				await ctx.storeSecret(key as SecretStateKey, value as string)
			} else {
				await ctx.updateGlobalState(key as GlobalStateKey, value)
			}
		},

		async setValues(values: JabberwockSettings) {
			const entries = Object.entries(values) as [JabberwockSettingsKey, unknown][]
			await Promise.all(entries.map(([key, value]) => this.setValue(key, value)))
		},

		getGlobalSettings(): GlobalSettings {
			const values = getAllValues()

			try {
				return globalSettingsSchema.parse(values)
			} catch (error) {
				if (error instanceof ZodError) {
					getTelemetryService().captureSchemaValidationError({ schemaName: "GlobalSettings", error })
				}

				return GLOBAL_SETTINGS_KEYS.reduce((acc, key) => ({ ...acc, [key]: values[key] }), {} as GlobalSettings)
			}
		},

		getProviderSettings(): ProviderSettings {
			const values = getAllValues()
			const sanitizedValues = sanitizeProviderValues(values)

			try {
				return providerSettingsSchema.parse(sanitizedValues)
			} catch (error) {
				if (error instanceof ZodError) {
					getTelemetryService().captureSchemaValidationError({ schemaName: "ProviderSettings", error })
				}

				return PROVIDER_SETTINGS_KEYS.reduce(
					(acc, key) => ({ ...acc, [key]: sanitizedValues[key] }),
					{} as ProviderSettings,
				)
			}
		},

		async setProviderSettings(values: ProviderSettings) {
			if (values.openAiHeaders !== undefined) {
				if (!values.openAiHeaders || Object.keys(values.openAiHeaders).length === 0) {
					values.openAiHeaders = {}
				}
			}

			const ctx = getVscodeContext()
			const resetValues = Object.fromEntries(
				PROVIDER_SETTINGS_KEYS.filter((key) => !isSecretStateKey(key))
					.filter((key) => {
						const v = ctx.getGlobalState(key as GlobalStateKey)
						return v !== undefined && v !== null
					})
					.map((key) => [key, undefined]),
			) as ProviderSettings

			await this.setValues({
				...resetValues,
				...values,
			} as JabberwockSettings)
		},

		async export(): Promise<GlobalSettings | undefined> {
			try {
				const globalSettings = globalSettingsExportSchema.parse(getAllValues())

				globalSettings.customModes = globalSettings.customModes?.filter((mode) => mode.source === "global")

				return Object.fromEntries(Object.entries(globalSettings).filter(([_, value]) => value !== undefined))
			} catch (error) {
				if (error instanceof ZodError) {
					getTelemetryService().captureSchemaValidationError({ schemaName: "GlobalSettings", error })
				}

				return undefined
			}
		},

		async resetAllState() {
			const ctx = getVscodeContext()
			const allStateKeys = [...GLOBAL_SETTINGS_KEYS, ...PROVIDER_SETTINGS_KEYS].filter(
				(key) => !isSecretStateKey(key as string),
			)

			await Promise.all([
				...allStateKeys.map((key) =>
					ctx.updateGlobalState(key as GlobalStateKey, undefined as GlobalState[GlobalStateKey]),
				),
				...SECRET_STATE_KEYS.map((key) => ctx.storeSecret(key as SecretStateKey, undefined)),
				...GLOBAL_SECRET_KEYS.map((key) => ctx.storeSecret(key as SecretStateKey, undefined)),
			])
		},
	}
}
