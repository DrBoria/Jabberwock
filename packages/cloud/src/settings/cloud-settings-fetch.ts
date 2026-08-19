import { getJabberwockApiUrl } from "../config.ts"

import type { OrganizationSettings, UserSettingsData } from "@jabberwock/types"

export async function doFetchSettings(token: string, log: (...args: unknown[]) => void): Promise<Response | undefined> {
	const response = await fetch(`${getJabberwockApiUrl()}/api/extension-settings`, {
		headers: {
			Authorization: `Bearer ${token}`,
		},
	})

	if (!response.ok) {
		log("[cloud-settings] Failed to fetch extension settings:", response.status, response.statusText)
		return undefined
	}

	return response
}

export function detectOrgSettingsChange(
	currentSettings: OrganizationSettings | undefined,
	newSettings: OrganizationSettings,
	setSettings: (value: OrganizationSettings) => void,
): boolean {
	if (!currentSettings || currentSettings.version !== newSettings.version) {
		setSettings(newSettings)
		return true
	}
	return false
}

export function detectUserSettingsChange(
	currentSettings: UserSettingsData | undefined,
	newSettings: UserSettingsData,
	setSettings: (value: UserSettingsData) => void,
): boolean {
	if (!currentSettings || currentSettings.version !== newSettings.version) {
		setSettings(newSettings)
		return true
	}
	return false
}
