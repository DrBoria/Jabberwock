import { type ProviderSettings, PROVIDER_SETTINGS_KEYS, providerSettingsSchema } from "../provider/combined-schemas.ts"
import { globalSettingsSchema, type GlobalSettings, GLOBAL_SETTINGS_KEYS } from "./schema.ts"
import { type Keys } from "../../utils/type-fu.ts"
import { type SecretState, isSecretStateKey } from "./state.ts"

/**
 * JabberwockSettings
 */

export const jabberwockSettingsSchema = providerSettingsSchema.merge(globalSettingsSchema)

export type JabberwockSettings = GlobalSettings & ProviderSettings

/**
 * GlobalState
 */

export type GlobalState = Omit<JabberwockSettings, Keys<SecretState>>

export const GLOBAL_STATE_KEYS = [...GLOBAL_SETTINGS_KEYS, ...PROVIDER_SETTINGS_KEYS].filter(
	(key: Keys<JabberwockSettings>) => !isSecretStateKey(key as string),
) as Keys<GlobalState>[]
