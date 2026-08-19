import * as path from "path"
import fs from "fs/promises"

import * as vscode from "vscode"

import type { ProviderSettingsManager } from "@features/settings/models/provider-settings-manager/ProviderSettingsManager"
import type { SettingsAccess } from "@utils/settings"
import { resolveDefaultSaveUri, saveLastExportPath } from "@utils/io/export"
import { safeWriteJson } from "@utils/io"

import os from "os"
export type ExportOptions = {
	providerSettingsManager: ProviderSettingsManager
	contextProxy: SettingsAccess
}

export const exportSettings = async ({ providerSettingsManager, contextProxy }: ExportOptions) => {
	const defaultUri = await resolveDefaultSaveUri(contextProxy, "lastSettingsExportPath", "jabberwock-settings.json", {
		useWorkspace: false,
		fallbackDir: path.join(os.homedir(), "Downloads"),
	})

	const uri = await vscode.window.showSaveDialog({
		filters: { JSON: ["json"] },
		defaultUri,
	})

	if (!uri) {
		return
	}

	await saveLastExportPath(contextProxy, "lastSettingsExportPath", uri)

	try {
		const providerProfiles = await providerSettingsManager.export()
		const globalSettings = await contextProxy.export()

		// It's okay if there are no global settings, but if there are no
		// provider profile configured then don't export. If we wanted to
		// support this case then the `importSettings` function would need to
		// be updated to handle the case where there are no provider profiles.
		if (typeof providerProfiles === "undefined") {
			return
		}

		// OpenAI Compatible settings are now correctly stored in codebaseIndexConfig
		// No workaround needed - they will be exported automatically with the config

		const dirname = path.dirname(uri.fsPath)
		await fs.mkdir(dirname, { recursive: true })
		await safeWriteJson(uri.fsPath, { providerProfiles, globalSettings })
	} catch (e) {
		console.error("[jabberwock] Failed to export settings:", e)
		// Don't re-throw - the UI will handle showing error messages
	}
}
