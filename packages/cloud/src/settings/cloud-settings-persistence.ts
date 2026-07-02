import type { ExtensionContext } from "vscode"

import type { OrganizationSettings, UserSettingsData } from "@jabberwock/types"

const ORGANIZATION_SETTINGS_CACHE_KEY = "organization-settings"
const USER_SETTINGS_CACHE_KEY = "user-settings"

export async function cacheSettings(
	context: ExtensionContext,
	settings: OrganizationSettings | undefined,
	userSettings: UserSettingsData | undefined,
): Promise<void> {
	if (settings) {
		await context.globalState.update(ORGANIZATION_SETTINGS_CACHE_KEY, settings)
	}

	if (userSettings) {
		await context.globalState.update(USER_SETTINGS_CACHE_KEY, userSettings)
	}
}

export function loadCachedSettings(context: ExtensionContext): {
	settings: OrganizationSettings | undefined
	userSettings: UserSettingsData | undefined
} {
	const settings = context.globalState.get<OrganizationSettings>(ORGANIZATION_SETTINGS_CACHE_KEY)
	const userSettings = context.globalState.get<UserSettingsData>(USER_SETTINGS_CACHE_KEY)
	return { settings, userSettings }
}

export async function removeSettings(context: ExtensionContext): Promise<void> {
	await context.globalState.update(ORGANIZATION_SETTINGS_CACHE_KEY, undefined)
	await context.globalState.update(USER_SETTINGS_CACHE_KEY, undefined)
}
