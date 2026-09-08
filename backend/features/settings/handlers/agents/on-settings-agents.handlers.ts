import { type ModeConfig } from "@jabberwock/types"
import { getTelemetryService, hasTelemetryService } from "@jabberwock/telemetry"
import { defaultModeSlug } from "@shared/modes"
import { t } from "@i18n"
import * as fs from "fs/promises"
import { fileExistsAtPath } from "@utils/io/fs"
import { resolveDefaultSaveUri, saveLastExportPath } from "@utils/io/export"
import { postStateToWebview } from "@features/foundation/window-manager/store"
import { getHostEnvironment } from "@features/foundation/host-context/context"
import { getSettingsAccess } from "@utils/settings"
import {
	loadAndMergeModes,
	requireContext,
	updateCustomModeInFile,
	deleteCustomModeFromFile,
	exportModeWithRules,
	importModeWithRules,
} from "@features/settings/agents"
import type { IntentHandlerContext as IntentBusCtx } from "@features/intents/context"
import { getUiDialogs } from "@features/foundation/capabilities/registry"
import { log as backendLog } from "@features/foundation/capabilities/backend-logger"
import {
	getCustomModeRulesFolderPath,
	deleteRulesFolder,
	resolveImportDefaultUri,
	postExportResult,
} from "./on-settings-agents.helpers"

import * as path from "path"
import * as os from "os"

export async function handleUpdateCustomMode(
	intent: { id: string; type: string; payload: unknown },
	ctx: IntentBusCtx,
): Promise<void> {
	const provider = ctx.provider
	if (!provider) return
	const modeConfig = intent.payload as { modeConfig: ModeConfig } | undefined
	if (!modeConfig?.modeConfig) return
	try {
		const existingModes = ctx.rootStore.settings.modes.customModes as { slug: string }[]
		const isNewMode = !existingModes.some((mode: { slug: string }) => mode.slug === modeConfig.modeConfig.slug)
		await updateCustomModeInFile(modeConfig.modeConfig.slug, modeConfig.modeConfig, requireContext())
		const customModes = await loadAndMergeModes(requireContext())
		await getHostEnvironment().updateGlobalState("customModes", customModes)
		await getHostEnvironment().updateGlobalState("mode", modeConfig.modeConfig.slug)
		await postStateToWebview(provider)
		if (hasTelemetryService()) {
			if (isNewMode) {
				getTelemetryService().captureCustomModeCreated(modeConfig.modeConfig.slug, modeConfig.modeConfig.name)
			} else {
				const existingMode = existingModes.find(
					(mode: { slug: string }) => mode.slug === modeConfig.modeConfig.slug,
				)
				const changedSettings = existingMode
					? (Object.keys(modeConfig.modeConfig) as Array<keyof ModeConfig>).filter(
							(key) =>
								JSON.stringify((existingMode as ModeConfig)[key]) !==
								JSON.stringify((modeConfig.modeConfig as ModeConfig)[key]),
						)
					: []
				if (changedSettings.length > 0) getTelemetryService().captureModeSettingChanged(changedSettings[0])
			}
		}
	} catch {
		// Error already shown to user by updateCustomMode
	}
}

export async function handleDeleteCustomMode(
	intent: { id: string; type: string; payload: unknown },
	ctx: IntentBusCtx,
): Promise<void> {
	const provider = ctx.provider
	if (!provider) return
	const payload = intent.payload as { slug: string; checkOnly?: boolean }
	if (!payload.slug) return
	const customModes = ctx.rootStore.settings.modes.customModes as { slug: string; source?: string }[]
	const modeToDelete = customModes.find((mode: { slug: string }) => mode.slug === payload.slug)
	if (!modeToDelete) return
	const scope = modeToDelete.source || "global"
	const rulesFolderPath = getCustomModeRulesFolderPath(payload.slug, scope)
	const rulesFolderExists = await fileExistsAtPath(rulesFolderPath)
	if (payload.checkOnly) {
		await provider.postMessageToWebview({
			type: "deleteCustomModeCheck",
			slug: payload.slug,
			rulesFolderPath: rulesFolderExists ? rulesFolderPath : undefined,
		})
		return
	}
	await deleteCustomModeFromFile(payload.slug, requireContext())
	if (rulesFolderExists) await deleteRulesFolder(payload.slug, rulesFolderPath)
	await getHostEnvironment().updateGlobalState("mode", defaultModeSlug)
	await postStateToWebview(provider)
}

export async function handleExportMode(
	intent: { id: string; type: string; payload: unknown },
	ctx: IntentBusCtx,
): Promise<void> {
	const provider = ctx.provider
	if (!provider) return
	const payload = intent.payload as { slug: string }
	if (!payload.slug) return
	try {
		const customModePrompts = (getHostEnvironment().getGlobalState("customModePrompts") || {}) as Record<
			string,
			unknown
		>
		const customPrompt = customModePrompts[payload.slug] as
			| { description?: string; roleDefinition?: string; whenToUse?: string; customInstructions?: string }
			| undefined
		const result = await exportModeWithRules(payload.slug, customPrompt)
		if (!result.success || !result.yaml) {
			postExportResult(provider, payload.slug, false, result.error)
			return
		}
		const defaultUri = await resolveDefaultSaveUri(
			getSettingsAccess(),
			"lastModeExportPath",
			`${payload.slug}-export.yaml`,
			{
				useWorkspace: true,
				fallbackDir: path.join(os.homedir(), "Downloads"),
			},
		)
		// D4g-2 (batch 3): save dialog + toast via the uiDialogs slot (D4c) — server mode resolves
		// undefined (no dialog), so the export is cancelled headless.
		const saveUri = await getUiDialogs().showSaveDialog({
			defaultUri,
			filters: { "YAML files": ["yaml", "yml"] },
			title: "Save mode export",
		})
		if (!saveUri) {
			postExportResult(provider, payload.slug, false, "Export cancelled")
			return
		}
		await saveLastExportPath(getSettingsAccess(), "lastModeExportPath", saveUri)
		await fs.writeFile(saveUri.fsPath, result.yaml, "utf-8")
		postExportResult(provider, payload.slug, true)
		await getUiDialogs().showInformationMessage(t("common:info.mode_exported", { mode: payload.slug }))
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		backendLog.info(`Failed to export mode ${payload.slug}: ${errorMessage}`)
		postExportResult(provider, payload.slug, false, errorMessage)
	}
}

export async function handleImportMode(
	intent: { id: string; type: string; payload: unknown },
	ctx: IntentBusCtx,
): Promise<void> {
	const provider = ctx.provider
	if (!provider) return
	const payload = intent.payload as { source: string }
	try {
		const defaultUri = await resolveImportDefaultUri()
		// D4g-2 (batch 3): open dialog via the uiDialogs slot (D4c) — server mode resolves
		// undefined (no dialog), so the import is cancelled headless.
		const fileUri = await getUiDialogs().showOpenDialog({
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: false,
			defaultUri,
			filters: { "YAML files": ["yaml", "yml"] },
			title: "Select mode export file to import",
		})
		if (!fileUri || !fileUri[0]) {
			provider.postMessageToWebview({ type: "importModeResult", success: false, error: "cancelled" })
			return
		}
		await getHostEnvironment().updateGlobalState("lastModeImportPath", fileUri[0].fsPath)
		const yamlContent = await fs.readFile(fileUri[0].fsPath, "utf-8")
		const result = await importModeWithRules(yamlContent, (payload.source || "project") as "global" | "project")
		if (!result.success) {
			provider.postMessageToWebview({ type: "importModeResult", success: false, error: result.error })
			publishNotificationError(t("common:errors.mode_import_failed", { error: result.error }))
			return
		}
		const customModes = await loadAndMergeModes(requireContext())
		await getHostEnvironment().updateGlobalState("customModes", customModes)
		await postStateToWebview(provider)
		provider.postMessageToWebview({ type: "importModeResult", success: true, slug: result.slug })
		await getUiDialogs().showInformationMessage(t("common:info.mode_imported"))
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		backendLog.info(`Failed to import mode: ${errorMessage}`)
		provider.postMessageToWebview({ type: "importModeResult", success: false, error: errorMessage })
		publishNotificationError(t("common:errors.mode_import_failed", { error: errorMessage }))
	}
}

import { publishNotificationError } from "@features/foundation/capabilities/notifications"
