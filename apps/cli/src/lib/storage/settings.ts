import fs from "fs/promises"
import path from "path"

import type { CliSettings } from "@/types/index.js"

import { getConfigDir } from "./index.js"
import { readJsonFile } from "./json-file.js"

export function getSettingsPath(): string {
	const settingsPath = path.join(getConfigDir(), "cli-settings.json")
	return settingsPath
}

export async function loadSettings(): Promise<CliSettings> {
	const settings = await readJsonFile<CliSettings>(getSettingsPath())
	return settings ?? {}
}

export async function saveSettings(settings: Partial<CliSettings>): Promise<void> {
	const configDir = getConfigDir()
	await fs.mkdir(configDir, { recursive: true })

	const existing = await loadSettings()
	const merged = { ...existing, ...settings }

	await fs.writeFile(getSettingsPath(), JSON.stringify(merged, null, 2), {
		mode: 0o600,
	})
}

export async function resetOnboarding(): Promise<void> {
	await saveSettings({ onboardingProviderChoice: undefined })
}
