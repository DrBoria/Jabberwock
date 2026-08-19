import { EventBridge, type ProviderHandle } from "@features/foundation/webview/EventBridge"
import { getBackendRootStore } from "@features/storeSingleton"
import { getProviderSettingsManager, ProviderSettingsManager } from "./provider-settings-manager"

async function activateAndLog(psm: ProviderSettingsManager, name: string): Promise<void> {
	const activated = await psm.activateProfile({ name })
	console.log(
		`[store/upsertProviderProfile] activateProfile returned:`,
		activated ? `name="${activated.name}"` : "undefined",
	)
}

function notifyTaskOfApiUpdate(id: string | undefined, profile: { [key: string]: unknown }): void {
	if (!id) {
		return
	}
	const currentTask = getBackendRootStore().chat.activeTask
	if (currentTask?.updateApiConfiguration) {
		currentTask.updateApiConfiguration(profile)
	}
}

function logUpsertError(error: unknown): void {
	const message = error instanceof Error ? error.message : String(error)
	console.log(`[store/upsertProviderProfile] ERROR: ${message}`)
	EventBridge.outputChannel?.appendLine(`Error upserting provider profile: ${message}`)
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

		getBackendRootStore().settings.apiConfig.setConfiguration(profile)
		getBackendRootStore().settings.apiConfig.setCurrentConfigName(name)

		const id = await psm.saveConfig(name, profile)
		console.log(`[store/upsertProviderProfile] saveConfig returned id="${id}"`)

		if (activate) {
			await activateAndLog(psm, name)
		}

		notifyTaskOfApiUpdate(id, profile)

		console.log(`[store/upsertProviderProfile] DONE: id="${id}"`)
		return id
	} catch (error) {
		logUpsertError(error)
		return undefined
	}
}

/**
 * Activates a provider profile by name.
 */
export async function activateProviderProfile(
	provider: ProviderHandle,
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
export async function getProfiles(_provider: EventBridge): Promise<string[]> {
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
export function getActiveProfile(_provider: EventBridge): string | undefined {
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
