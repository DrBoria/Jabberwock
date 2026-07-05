import os from "os"
import * as path from "path"

import * as vscode from "vscode"
import { ZodError } from "zod"

import { type ModeConfig } from "@jabberwock/types"
import { getTelemetryService } from "@jabberwock/telemetry"

import { updateCustomModeInFile, requireContext } from "@features/settings/agents"
import { resolveDefaultSaveUri } from "@utils/io/export"

import type { ImportOptions, ImportWithProviderOptions } from "./importSettings.types"
import { parseSettingsFile, validateApiConfigs, resolveCurrentApiConfig } from "./importSettings.helpers"

export async function importSettingsFromPath(
	filePath: string,
	{ providerSettingsManager, contextProxy }: ImportOptions,
) {
	try {
		const previousProviderProfiles = await providerSettingsManager.export()

		const { rawProviderProfiles, globalSettings } = await parseSettingsFile(filePath)

		const { validApiConfigs, warnings } = validateApiConfigs(rawProviderProfiles)

		if (Object.keys(validApiConfigs).length === 0 && warnings.length > 0) {
			return {
				success: false,
				error: `No valid profiles could be imported:\n${warnings.join("\n")}`,
			}
		}

		const currentApiConfigName = resolveCurrentApiConfig(
			rawProviderProfiles,
			validApiConfigs,
			previousProviderProfiles.currentApiConfigName,
		)

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

		const customModes = (globalSettings as { customModes?: ModeConfig[] }).customModes ?? []
		await Promise.all(customModes.map((mode) => updateCustomModeInFile(mode.slug, mode, requireContext())))

		await providerSettingsManager.import(providerProfiles)
		await contextProxy.setValues(globalSettings)

		const currentProvider = providerProfiles.apiConfigs[currentApiConfigName]
		contextProxy.setValue("currentApiConfigName", currentApiConfigName)

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

export const importSettings = async ({ providerSettingsManager, contextProxy }: ImportOptions) => {
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

export async function importSettingsWithFeedback(options: ImportWithProviderOptions, filePath?: string) {
	const result = filePath ? await importSettingsFromPath(filePath, options) : await importSettings(options)

	await options.provider.postMessageToWebview({
		type: "settingsImportResult",
		...result,
	})

	return result
}
