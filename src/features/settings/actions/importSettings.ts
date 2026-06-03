import os from "os"
import * as path from "path"
import fs from "fs/promises"

import * as vscode from "vscode"
import { z, ZodError } from "zod"

import {
	globalSettingsSchema,
	providerSettingsWithIdSchema,
	isProviderName,
	type ProviderSettingsWithId,
} from "@jabberwock/types"
import { getTelemetryService } from "@jabberwock/telemetry"

import { ProviderSettingsManager, providerProfilesSchema } from "../models/ProviderSettingsManager"
import type { SettingsAccess } from "@utils/settings-access"
import { updateCustomModeInFile, requireContext } from "../agents/modesFileService"
import { getBackendRootStore } from "@features/storeSingleton"
import { resolveDefaultSaveUri } from "../../../utils/export"
import { postStateToWebview } from "@features/foundation/window-manager/store"
import { t } from "../../../i18n"

export type ImportOptions = {
	providerSettingsManager: ProviderSettingsManager
	contextProxy: SettingsAccess
}

type ImportWithProviderOptions = ImportOptions & {
	provider: import("@features/foundation/webview/EventBridge").ProviderHandle
}

/**
 * Sanitizes a provider config by resetting invalid/removed apiProvider values.
 * Returns the sanitized config and a warning message if the provider was invalid.
 */
function sanitizeProviderConfig(configName: string, apiConfig: unknown): { config: unknown; warning?: string } {
	if (typeof apiConfig !== "object" || apiConfig === null) {
		return { config: apiConfig }
	}

	const config = apiConfig as { [key: string]: unknown }

	// Check if apiProvider is set and if it's still valid
	if (config.apiProvider !== undefined && !isProviderName(config.apiProvider)) {
		const invalidProvider = config.apiProvider
		// Return a new config object without the invalid apiProvider
		const { apiProvider, ...restConfig } = config
		return {
			config: restConfig,
			warning: `Profile "${configName}": Invalid provider "${invalidProvider}" was removed. Please reconfigure this profile.`,
		}
	}

	return { config: apiConfig }
}

/**
 * Imports configuration from a specific file path
 * Shares base functionality for import settings for both the manual
 * and automatic settings importing.
 *
 * Uses lenient parsing to handle invalid/removed providers gracefully:
 * - Invalid apiProvider values are removed (profile is kept but needs reconfiguration)
 * - Completely invalid profiles are skipped
 * - Warnings are returned for any issues encountered
 */
export async function importSettingsFromPath(
	filePath: string,
	{ providerSettingsManager, contextProxy }: ImportOptions,
) {
	// Use a lenient schema that accepts any apiConfigs, then validate each individually
	const lenientProviderProfilesSchema = providerProfilesSchema.extend({
		apiConfigs: z.record(z.string(), z.unknown()),
	})

	const lenientSchema = z.object({
		providerProfiles: lenientProviderProfilesSchema,
		globalSettings: globalSettingsSchema.optional(),
	})

	try {
		const previousProviderProfiles = await providerSettingsManager.export()

		const rawData = JSON.parse(await fs.readFile(filePath, "utf-8"))
		const { providerProfiles: rawProviderProfiles, globalSettings = {} } = lenientSchema.parse(rawData)

		// Track warnings for profiles that had issues
		const warnings: string[] = []
		const validApiConfigs: Record<string, ProviderSettingsWithId> = {}

		// Process each apiConfig individually with sanitization
		for (const [configName, rawConfig] of Object.entries(rawProviderProfiles.apiConfigs)) {
			// First sanitize to handle invalid apiProvider values
			const { config: sanitizedConfig, warning } = sanitizeProviderConfig(configName, rawConfig)
			if (warning) {
				warnings.push(warning)
			}

			// Then validate the sanitized config
			const result = providerSettingsWithIdSchema.safeParse(sanitizedConfig)
			if (result.success) {
				validApiConfigs[configName] = result.data
			} else {
				// Profile is completely invalid - skip it
				const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")
				warnings.push(`Profile "${configName}" was skipped: ${issues}`)
			}
		}

		// If no valid configs were imported and there were issues, report them
		if (Object.keys(validApiConfigs).length === 0 && warnings.length > 0) {
			return {
				success: false,
				error: `No valid profiles could be imported:\n${warnings.join("\n")}`,
			}
		}

		// Determine the currentApiConfigName:
		// 1. If the imported currentApiConfigName exists in validApiConfigs, use it
		// 2. Otherwise, fall back to the first valid imported profile
		// 3. If no valid profiles were imported, keep the previous currentApiConfigName
		let currentApiConfigName = rawProviderProfiles.currentApiConfigName
		const validProfileNames = Object.keys(validApiConfigs)
		if (!validApiConfigs[currentApiConfigName]) {
			if (validProfileNames.length > 0) {
				currentApiConfigName = validProfileNames[0]
				warnings.push(
					`Profile "${rawProviderProfiles.currentApiConfigName}" was not available; defaulting to "${currentApiConfigName}".`,
				)
			} else {
				// No valid imported profiles; keep the existing currentApiConfigName
				currentApiConfigName = previousProviderProfiles.currentApiConfigName
			}
		}

		const providerProfiles = {
			currentApiConfigName,
			apiConfigs: {
				...previousProviderProfiles.apiConfigs,
				...validApiConfigs,
			},
			modeApiConfigs: {
				...previousProviderProfiles.modeApiConfigs,
				...rawProviderProfiles.modeApiConfigs,
			},
		}

		await Promise.all(
			(globalSettings.customModes ?? []).map((mode) => updateCustomModeInFile(mode.slug, mode, requireContext())),
		)

		// OpenAI Compatible settings are now correctly stored in codebaseIndexConfig
		// They will be imported automatically with the config - no special handling needed

		await providerSettingsManager.import(providerProfiles)
		await contextProxy.setValues(globalSettings)

		// Set the current provider.
		const currentProviderName = providerProfiles.currentApiConfigName
		const currentProvider = providerProfiles.apiConfigs[currentProviderName]
		contextProxy.setValue("currentApiConfigName", currentProviderName)

		// TODO: It seems like we don't need to have the provider settings in
		// the proxy; we can just use providerSettingsManager as the source of
		// truth.
		if (currentProvider) {
			contextProxy.setProviderSettings(currentProvider)
		}

		contextProxy.setValue("listApiConfigMeta", await providerSettingsManager.listConfig())

		return {
			providerProfiles,
			globalSettings,
			success: true,
			warnings: warnings.length > 0 ? warnings : undefined,
		}
	} catch (e) {
		let error = "Unknown error"

		if (e instanceof ZodError) {
			error = e.issues.map((issue) => `[${issue.path.join(".")}]: ${issue.message}`).join("\n")
			getTelemetryService().captureSchemaValidationError({ schemaName: "ImportExport", error: e })
		} else if (e instanceof Error) {
			error = e.message
		}

		return { success: false, error }
	}
}

/**
 * Import settings from a file using a file dialog
 * @param options - Import options containing managers and proxy
 * @returns Promise resolving to import result
 */
export const importSettings = async ({ providerSettingsManager, contextProxy }: ImportOptions) => {
	// Use the last export path as a sensible default, falling back to Downloads
	const defaultUri = resolveDefaultSaveUri(contextProxy, "lastSettingsExportPath", "jabberwock-settings.json", {
		useWorkspace: false,
		fallbackDir: path.join(os.homedir(), "Downloads"),
	})

	const uris = await vscode.window.showOpenDialog({
		filters: { JSON: ["json"] },
		canSelectMany: false,
		defaultUri,
	})

	if (!uris) {
		return { success: false, error: "User cancelled file selection" }
	}

	return importSettingsFromPath(uris[0].fsPath, {
		providerSettingsManager,
		contextProxy,
	})
}

/**
 * Import settings from a specific file
 * @param options - Import options containing managers and proxy
 * @param fileUri - URI of the file to import from
 * @returns Promise resolving to import result
 */
export const importSettingsFromFile = async (
	{ providerSettingsManager, contextProxy }: ImportOptions,
	fileUri: vscode.Uri,
) => {
	return importSettingsFromPath(fileUri.fsPath, {
		providerSettingsManager,
		contextProxy,
	})
}

/**
 * Import settings with complete UI feedback and provider state updates
 * @param options - Import options with provider instance
 * @param filePath - Optional file path to import from. If not provided, a file dialog will be shown.
 * @returns Promise that resolves when import is complete
 */
export const importSettingsWithFeedback = async (
	{ providerSettingsManager, contextProxy, provider }: ImportWithProviderOptions,
	filePath?: string,
) => {
	type ImportResult = Awaited<ReturnType<typeof importSettingsFromPath>>
	let result: ImportResult

	if (filePath) {
		// Validate file path and check if file exists
		try {
			await fs.access(filePath, fs.constants.F_OK | fs.constants.R_OK)
			result = await importSettingsFromPath(filePath, {
				providerSettingsManager,
				contextProxy,
			})
		} catch (error) {
			result = {
				success: false,
				error: `Cannot access file at path "${filePath}": ${error instanceof Error ? error.message : "Unknown error"}`,
			}
		}
	} else {
		result = await importSettings({ providerSettingsManager, contextProxy })
	}

	if (result.success) {
		getBackendRootStore().settings.setSettingsImportedAt(Date.now())
		await postStateToWebview(provider)

		// Show warnings if any profiles had issues but were still imported (with modifications)
		if (result.warnings && result.warnings.length > 0) {
			// Log full details to the console for debugging
			console.warn("[jabberwock] Settings import completed with warnings:", result.warnings)

			// Show a short summary in the toast notification
			const count = result.warnings.length
			const summary =
				count === 1 ? `1 profile had issues during import.` : `${count} profiles had issues during import.`
			await vscode.window.showWarningMessage(
				`${t("common:info.settings_imported")} ${summary} See Developer Tools console for details.`,
			)
		} else {
			await vscode.window.showInformationMessage(t("common:info.settings_imported"))
		}
	} else if (result.error) {
		await vscode.window.showErrorMessage(t("common:errors.settings_import_failed", { error: result.error }))
	}
}
