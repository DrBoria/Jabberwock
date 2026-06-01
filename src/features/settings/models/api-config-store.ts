import { types, Instance } from "mobx-state-tree"
import { isSecretStateKey, type JabberwockSettings } from "@jabberwock/types"
import { EventBridge } from "../../foundation/webview/EventBridge"
import { getBackendRootStore } from "@features/storeSingleton"
import { getSettingsAccess } from "@utils/settings-access"
import { getProviderSettingsManager } from "./ProviderSettingsManager"
import { postStateToWebview } from "../../foundation/window-manager/store"

const KNOWN_FIELDS = [
	"apiProvider",
	"apiModelId",
	"baseUrl",
	"apiKey",
	"includeMaxTokens",
	"todoListEnabled",
	"modelTemperature",
	"rateLimitSeconds",
	"consecutiveMistakeLimit",
	"enableReasoningEffort",
	"reasoningEffort",
	"modelMaxTokens",
	"modelMaxThinkingTokens",
	"verbosity",
	"id",
] as const

export const ApiConfigModel = types
	.model("ApiConfig", {
		// Identity
		id: types.string,
		currentConfigName: types.string,
		listApiConfigMeta: types.frozen<Array<{ name: string; id: string; apiProvider?: string; modelId?: string }>>(),

		// Core provider config (what buildApiHandler needs)
		apiProvider: types.string,
		apiModelId: types.string,
		baseUrl: types.string,

		// Common base settings (from baseProviderSettingsSchema)
		includeMaxTokens: types.boolean,
		todoListEnabled: types.boolean,
		modelTemperature: types.number,
		rateLimitSeconds: types.number,
		consecutiveMistakeLimit: types.number,
		enableReasoningEffort: types.boolean,
		reasoningEffort: types.string,
		modelMaxTokens: types.number,
		modelMaxThinkingTokens: types.number,
		verbosity: types.number,

		// Auth
		apiKey: types.string,

		// Provider-specific fields (catch-all for keys like openAiApiKey, bedrockApiKey, etc.)
		providerSpecificFields: types.frozen<{ [key: string]: unknown }>(),
	})
	.actions((self) => ({
		setConfiguration(config: { [key: string]: unknown }): void {
			const known = new Set<string>(KNOWN_FIELDS)
			const rest: { [key: string]: unknown } = {}

			for (const [key, value] of Object.entries(config)) {
				if (known.has(key)) {
					Object.assign(self, { [key]: value })
				} else {
					rest[key] = value
				}
			}

			self.providerSpecificFields = rest
		},

		setCurrentConfigName(name: string): void {
			self.currentConfigName = name
		},

		setListApiConfigMeta(list: Array<{ name: string; id: string; apiProvider?: string; modelId?: string }>): void {
			self.listApiConfigMeta = list
		},

		clear(): void {
			self.id = ""
			self.currentConfigName = ""
			self.listApiConfigMeta = []
			self.apiProvider = ""
			self.apiModelId = ""
			self.baseUrl = ""
			self.apiKey = ""
			self.includeMaxTokens = false
			self.todoListEnabled = false
			self.modelTemperature = 0
			self.rateLimitSeconds = 0
			self.consecutiveMistakeLimit = 0
			self.enableReasoningEffort = false
			self.reasoningEffort = ""
			self.modelMaxTokens = 0
			self.modelMaxThinkingTokens = 0
			self.verbosity = 0
			self.providerSpecificFields = {}
		},
	}))
	.views((self) => ({
		toProviderSettings(): { [key: string]: unknown } {
			const result: { [key: string]: unknown } = {
				...self.providerSpecificFields,
			}

			// Explicitly copy each known field — type-safe, avoids dynamic casting
			if (self.id !== undefined) result.id = self.id
			if (self.apiProvider !== undefined) result.apiProvider = self.apiProvider
			if (self.apiModelId !== undefined) result.apiModelId = self.apiModelId
			if (self.baseUrl !== undefined) result.baseUrl = self.baseUrl
			if (self.apiKey !== undefined) result.apiKey = self.apiKey
			if (self.includeMaxTokens !== undefined) result.includeMaxTokens = self.includeMaxTokens
			if (self.todoListEnabled !== undefined) result.todoListEnabled = self.todoListEnabled
			if (self.modelTemperature !== undefined) result.modelTemperature = self.modelTemperature
			if (self.rateLimitSeconds !== undefined) result.rateLimitSeconds = self.rateLimitSeconds
			if (self.consecutiveMistakeLimit !== undefined)
				result.consecutiveMistakeLimit = self.consecutiveMistakeLimit
			if (self.enableReasoningEffort !== undefined) result.enableReasoningEffort = self.enableReasoningEffort
			if (self.reasoningEffort !== undefined) result.reasoningEffort = self.reasoningEffort
			if (self.modelMaxTokens !== undefined) result.modelMaxTokens = self.modelMaxTokens
			if (self.modelMaxThinkingTokens !== undefined) result.modelMaxThinkingTokens = self.modelMaxThinkingTokens
			if (self.verbosity !== undefined) result.verbosity = self.verbosity

			return result
		},
	}))

export type IApiConfigModel = Instance<typeof ApiConfigModel>

// Backward-compatible types and functions
export type ApiConfigState = object

export function initApiConfigState(_provider: EventBridge): void {}

import type { IBackendRootStore } from "../../store"

export function getApiConfigState(rootStore: IBackendRootStore): ApiConfigState {
	return rootStore.settings.apiConfig as ApiConfigState
}

/**
 * Upserts a provider profile.
 */
export async function upsertProviderProfile(
	provider: EventBridge,
	name: string,
	profile: { [key: string]: unknown },
	activate?: boolean,
): Promise<string | undefined> {
	console.log(
		`[store/upsertProviderProfile] START: name="${name}", activate=${activate}, apiProvider="${profile?.apiProvider}"`,
	)
	console.log(`[store/upsertProviderProfile] providerSettingsManager exists:`, !!getProviderSettingsManager())
	try {
		const psm = getProviderSettingsManager()
		if (!psm) {
			console.log(`[store/upsertProviderProfile] ERROR: providerSettingsManager is undefined!`)
			return undefined
		}

		// 1. Update MST store first
		getBackendRootStore().settings.apiConfig.setConfiguration(profile)
		getBackendRootStore().settings.apiConfig.setCurrentConfigName(name)

		// 2. Persist to VS Code secrets via PSM
		const id = await psm.saveConfig(name, profile)
		console.log(`[store/upsertProviderProfile] saveConfig returned id="${id}"`)

		if (activate) {
			const activated = await psm.activateProfile({ name })
			console.log(
				`[store/upsertProviderProfile] activateProfile returned:`,
				activated ? `name="${activated.name}"` : "undefined",
			)
		}

		// Notify the current task about the updated API configuration so it can
		// rebuild its API handler without waiting for a full provider cycle.
		if (id) {
			const currentTask = getBackendRootStore().chat.activeTask
			if (currentTask?.updateApiConfiguration) {
				currentTask.updateApiConfiguration(profile)
			}
		}

		console.log(`[store/upsertProviderProfile] DONE: id="${id}"`)
		return id
	} catch (error) {
		console.log(`[store/upsertProviderProfile] ERROR: ${error instanceof Error ? error.message : String(error)}`)
		EventBridge.outputChannel?.appendLine(
			`Error upserting provider profile: ${error instanceof Error ? error.message : String(error)}`,
		)
		return undefined
	}
}

/**
 * Activates a provider profile by name.
 */
export async function activateProviderProfile(
	provider: EventBridge,
	options: { name: string } | { id: string },
): Promise<{ [key: string]: unknown } | undefined> {
	try {
		const profile = await getProviderSettingsManager()!.activateProfile(options)

		// Update MST store if profile was activated
		if (profile) {
			getBackendRootStore().settings.apiConfig.setConfiguration(profile)
			getBackendRootStore().settings.apiConfig.setCurrentConfigName(profile.name)

			// Notify the current task about the activated profile so it can rebuild
			// its API handler immediately.
			const currentTask = getBackendRootStore().chat.activeTask
			if (currentTask?.updateApiConfiguration) {
				currentTask.updateApiConfiguration(profile)
			}
		}

		return profile
	} catch (error) {
		EventBridge.outputChannel?.appendLine(
			`Error activating provider profile: ${error instanceof Error ? error.message : String(error)}`,
		)
		return undefined
	}
}

/**
 * Deletes a provider profile.
 */
export async function deleteProviderProfile(provider: EventBridge, entry: string | { name?: string }): Promise<void> {
	try {
		const name = typeof entry === "string" ? entry : entry?.name
		if (name) {
			await getProviderSettingsManager()!.deleteConfig(name)
			getBackendRootStore().settings.apiConfig.clear()
		}
	} catch (error) {
		EventBridge.outputChannel?.appendLine(
			`Error deleting provider profile: ${error instanceof Error ? error.message : String(error)}`,
		)
	}
}

/**
 * Creates a new provider profile.
 * @throws Error if the profile already exists.
 */
export async function createProviderProfile(
	provider: EventBridge,
	name: string,
	profile?: { [key: string]: unknown },
	activate?: boolean,
): Promise<string> {
	// Check if profile already exists (via profile entry lookup)
	const existing = await getProfileEntry(provider, name)
	if (existing) {
		throw new Error(`Profile with name "${name}" already exists`)
	}

	const id = await upsertProviderProfile(provider, name, profile ?? {}, activate)
	if (!id) {
		throw new Error(`Failed to create profile with name "${name}"`)
	}

	return id
}

/**
 * Updates an existing provider profile.
 * @throws Error if the profile does not exist.
 */
export async function updateProviderProfile(
	provider: EventBridge,
	name: string,
	profile: { [key: string]: unknown },
	activate?: boolean,
): Promise<string | undefined> {
	const existing = await getProfileEntry(provider, name)
	if (!existing) {
		throw new Error(`Profile with name "${name}" does not exist`)
	}

	const id = await upsertProviderProfile(provider, name, profile, activate)
	if (!id) {
		throw new Error(`Failed to update profile with name "${name}"`)
	}

	return id
}

/**
 * Gets a profile entry by name.
 */
export async function getProfileEntry(
	provider: EventBridge,
	name: string,
): Promise<{ [key: string]: unknown } | undefined> {
	const psm = getProviderSettingsManager()
	if (!psm) {
		return undefined
	}

	try {
		const configs = await psm.listConfig()
		return configs.find((c: { [key: string]: unknown }) => c.name === name)
	} catch {
		return undefined
	}
}

/**
 * Gets all profile names.
 */
export async function getProfiles(provider: EventBridge): Promise<string[]> {
	const psm = getProviderSettingsManager()
	if (!psm) {
		return []
	}

	try {
		const configs = await psm.listConfig()
		return configs.map((c: { [key: string]: unknown }) => c.name as string)
	} catch {
		return []
	}
}

/**
 * Gets the currently active profile name.
 */
export function getActiveProfile(provider: EventBridge): string | undefined {
	const state = getBackendRootStore()
	return (state.settings.apiConfig as { currentConfigName?: string })?.currentConfigName
}

/**
 * Sets the active profile by name.
 */
export async function setActiveProfile(provider: EventBridge, name: string): Promise<string | undefined> {
	const existing = await getProfileEntry(provider, name)
	if (!existing) {
		throw new Error(`Profile with name "${name}" does not exist`)
	}

	await activateProviderProfile(provider, { name })
	return getActiveProfile(provider)
}

/**
 * Gets the current configuration (minus secrets).
 */
export function getConfiguration(provider: EventBridge): JabberwockSettings {
	return Object.fromEntries(
		Object.entries(getSettingsAccess().getValues()).filter(([key]) => !isSecretStateKey(key)),
	) as JabberwockSettings
}

/**
 * Sets the configuration for the current API profile.
 */
export async function setConfiguration(provider: EventBridge, values: JabberwockSettings): Promise<void> {
	await getSettingsAccess().setValues(values)
	await getProviderSettingsManager()?.saveConfig(values.currentApiConfigName || "default", values)
	await postStateToWebview(provider)
}
