import * as path from "path"
import * as os from "os"

import { Package } from "@shared/package"
import { fileExistsAtPath } from "@utils/io/fs"
import { t } from "@i18n"
import { getBackendLogger, getConfiguration, getUiDialogs } from "@features/foundation/capabilities/registry"

import { importSettingsFromPath } from "@features/settings/actions/importSettings"
import type { ImportOptions } from "@features/settings/actions/importSettings.types"

/**
 * Automatically imports Jabberwock settings from a specified path if it exists.
 * This function is called during extension activation to allow users to pre-configure
 * their settings by placing a settings file at a predefined location.
 */
export async function autoImportSettings({ providerSettingsManager, contextProxy }: ImportOptions): Promise<void> {
	try {
		// Get the auto-import settings path from VSCode settings
		const settingsPath = getConfiguration().get<string>(Package.name, "autoImportSettingsPath")

		if (!settingsPath || settingsPath.trim() === "") {
			getBackendLogger().appendLine("[AutoImport] No auto-import settings path specified, skipping auto-import")
			return
		}

		// Resolve the path (handle ~ for home directory and relative paths)
		const resolvedPath = resolvePath(settingsPath.trim())
		getBackendLogger().appendLine(`[AutoImport] Checking for settings file at: ${resolvedPath}`)

		// Check if the file exists
		if (!(await fileExistsAtPath(resolvedPath))) {
			getBackendLogger().appendLine(
				`[AutoImport] Settings file not found at ${resolvedPath}, skipping auto-import`,
			)
			return
		}

		// Attempt to import the configuration
		const result = await importSettingsFromPath(resolvedPath, {
			providerSettingsManager,
			contextProxy,
		})

		if (result.success) {
			getBackendLogger().appendLine(`[AutoImport] Successfully imported settings from ${resolvedPath}`)

			// Show a notification to the user
			getUiDialogs().showInformationMessage(
				t("common:info.auto_import_success", { filename: path.basename(resolvedPath) }),
			)
		} else {
			getBackendLogger().appendLine(`[AutoImport] Failed to import settings: ${result.error}`)

			// Show a warning but don't fail the extension activation
			getUiDialogs().showWarningMessage(t("common:warnings.auto_import_failed", { error: result.error }))
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		getBackendLogger().appendLine(`[AutoImport] Unexpected error during auto-import: ${errorMessage}`)

		// Log error but don't fail extension activation
		console.warn("[jabberwock] Auto-import settings error:", error)
	}
}

/**
 * Resolves a file path, handling home directory expansion and relative paths
 */
function resolvePath(settingsPath: string): string {
	// Handle home directory expansion
	if (settingsPath.startsWith("~/")) {
		return path.join(os.homedir(), settingsPath.slice(2))
	}

	// Handle absolute paths
	if (path.isAbsolute(settingsPath)) {
		return settingsPath
	}

	// Handle relative paths (relative to home directory for safety)
	return path.join(os.homedir(), settingsPath)
}
