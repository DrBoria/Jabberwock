import { IntentType, type ModeConfig } from "@jabberwock/types"
import type { IntentBus } from "../../intents/bus"
import { TelemetryService, getTelemetryService, hasTelemetryService } from "@jabberwock/telemetry"
import { defaultModeSlug, getAllModes } from "../../../shared/modes"
import { openFile } from "../../../integrations/misc/open-file"
import { t } from "../../../i18n"
import * as vscode from "vscode"
import * as os from "os"
import * as path from "path"
import * as fs from "fs/promises"
import { fileExistsAtPath } from "../../../utils/fs"
import { getWorkspacePath } from "../../../utils/path"
import { resolveDefaultSaveUri, saveLastExportPath } from "../../../utils/export"
import { postStateToWebview } from "@features/foundation/window-manager/store"
import { getVscodeContext } from "../../foundation/vscode/context"
import { getSettingsAccess } from "@utils/settings-access"
import {
	loadAndMergeModes,
	requireContext,
	updateCustomModeInFile,
	deleteCustomModeFromFile,
	exportModeWithRules,
	importModeWithRules,
	checkRulesDirectoryHasContent,
	getCustomModesFilePath,
} from "../agents/modesFileService"
import { EventBridge } from "@features/foundation/webview/EventBridge"

/**
 * Register all agents/modes settings intent handlers.
 */
export function registerOnSettingsAgents(bus: IntentBus): void {
	// ── updateCustomMode ──────────────────────────────────────────────
	bus.register(IntentType.SettingsModeCustomUpdate, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const modeConfig = intent.payload as { modeConfig: ModeConfig } | undefined
		if (!modeConfig?.modeConfig) return

		try {
			const existingModes = ctx.rootStore.settings.modes.customModes as { slug: string }[]
			const isNewMode = !existingModes.some((mode: { slug: string }) => mode.slug === modeConfig.modeConfig?.slug)

			await updateCustomModeInFile(modeConfig.modeConfig.slug as string, modeConfig.modeConfig, requireContext())
			const customModes = await loadAndMergeModes(requireContext())
			await getVscodeContext().updateGlobalState("customModes", customModes)
			await getVscodeContext().updateGlobalState("mode", modeConfig.modeConfig.slug as string)
			await postStateToWebview(provider)

			if (hasTelemetryService()) {
				if (isNewMode) {
					getTelemetryService().captureCustomModeCreated(
						modeConfig.modeConfig.slug as string,
						modeConfig.modeConfig.name as string,
					)
				} else {
					const existingMode = existingModes.find(
						(mode: { slug: string }) => mode.slug === modeConfig.modeConfig?.slug,
					)
					const changedSettings = existingMode
						? (Object.keys(modeConfig.modeConfig) as Array<keyof ModeConfig>).filter(
								(key) =>
									JSON.stringify((existingMode as ModeConfig)[key]) !==
									JSON.stringify((modeConfig.modeConfig as ModeConfig)[key]),
							)
						: []

					if (changedSettings.length > 0) {
						getTelemetryService().captureModeSettingChanged(changedSettings[0])
					}
				}
			}
		} catch (error) {
			// Error already shown to user by updateCustomMode
		}
	})

	// ── deleteCustomMode ──────────────────────────────────────────────
	bus.register(IntentType.SettingsModeCustomDelete, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { slug: string; checkOnly?: boolean }
		if (!payload.slug) return

		const customModes = ctx.rootStore.settings.modes.customModes as { slug: string; source?: string }[]
		const modeToDelete = customModes.find((mode: { slug: string }) => mode.slug === payload.slug)

		if (!modeToDelete) return

		const scope = modeToDelete.source || "global"

		let rulesFolderPath: string
		if (scope === "project") {
			const workspacePath = getWorkspacePath()
			if (workspacePath) {
				rulesFolderPath = path.join(workspacePath, ".jabberwock", `rules-${payload.slug}`)
			} else {
				rulesFolderPath = path.join(".jabberwock", `rules-${payload.slug}`)
			}
		} else {
			const homeDir = os.homedir()
			rulesFolderPath = path.join(homeDir, ".jabberwock", `rules-${payload.slug}`)
		}

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

		if (rulesFolderExists) {
			try {
				await fs.rm(rulesFolderPath, { recursive: true, force: true })
				EventBridge.outputChannel?.appendLine(
					`Deleted rules folder for mode ${payload.slug}: ${rulesFolderPath}`,
				)
			} catch (error) {
				EventBridge.outputChannel?.appendLine(
					`Failed to delete rules folder for mode ${payload.slug}: ${error}`,
				)
				vscode.window.showErrorMessage(
					t("common:errors.delete_rules_folder_failed", {
						rulesFolderPath,
						error: error instanceof Error ? error.message : String(error),
					}),
				)
			}
		}

		await getVscodeContext().updateGlobalState("mode", defaultModeSlug)
		await postStateToWebview(provider)
	})

	// ── exportMode ────────────────────────────────────────────────────
	bus.register(IntentType.SettingsModeExport, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { slug: string }
		if (!payload.slug) return

		try {
			const customModePrompts = (getVscodeContext().getGlobalState("customModePrompts") || {}) as Record<
				string,
				unknown
			>
			const customPrompt = customModePrompts[payload.slug] as
				| { description?: string; roleDefinition?: string; whenToUse?: string; customInstructions?: string }
				| undefined

			const result = await exportModeWithRules(payload.slug, customPrompt)

			if (result.success && result.yaml) {
				const defaultUri = await resolveDefaultSaveUri(
					getSettingsAccess(),
					"lastModeExportPath",
					`${payload.slug}-export.yaml`,
					{
						useWorkspace: true,
						fallbackDir: path.join(os.homedir(), "Downloads"),
					},
				)

				const saveUri = await vscode.window.showSaveDialog({
					defaultUri,
					filters: {
						"YAML files": ["yaml", "yml"],
					},
					title: "Save mode export",
				})

				if (saveUri && result.yaml) {
					await saveLastExportPath(getSettingsAccess(), "lastModeExportPath", saveUri)
					await fs.writeFile(saveUri.fsPath, result.yaml, "utf-8")
					provider.postMessageToWebview({
						type: "exportModeResult",
						success: true,
						slug: payload.slug,
					})

					vscode.window.showInformationMessage(t("common:info.mode_exported", { mode: payload.slug }))
				} else {
					provider.postMessageToWebview({
						type: "exportModeResult",
						success: false,
						error: "Export cancelled",
						slug: payload.slug,
					})
				}
			} else {
				provider.postMessageToWebview({
					type: "exportModeResult",
					success: false,
					error: result.error,
					slug: payload.slug,
				})
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			EventBridge.outputChannel?.appendLine(`Failed to export mode ${payload.slug}: ${errorMessage}`)
			provider.postMessageToWebview({
				type: "exportModeResult",
				success: false,
				error: errorMessage,
				slug: payload.slug,
			})
		}
	})

	// ── importMode ────────────────────────────────────────────────────
	bus.register(IntentType.SettingsModeImport, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { source: string }

		try {
			const lastImportPath = getVscodeContext().getGlobalState("lastModeImportPath") as string | undefined
			let defaultUri: vscode.Uri | undefined

			if (lastImportPath) {
				const lastDir = path.dirname(lastImportPath)
				defaultUri = vscode.Uri.file(lastDir)
			} else {
				const workspaceFolders = vscode.workspace.workspaceFolders
				if (workspaceFolders && workspaceFolders.length > 0) {
					defaultUri = vscode.Uri.file(workspaceFolders[0].uri.fsPath)
				}
			}

			const fileUri = await vscode.window.showOpenDialog({
				canSelectFiles: true,
				canSelectFolders: false,
				canSelectMany: false,
				defaultUri,
				filters: {
					"YAML files": ["yaml", "yml"],
				},
				title: "Select mode export file to import",
			})

			if (fileUri && fileUri[0]) {
				await getVscodeContext().updateGlobalState("lastModeImportPath", fileUri[0].fsPath)

				const yamlContent = await fs.readFile(fileUri[0].fsPath, "utf-8")

				const result = await importModeWithRules(
					yamlContent,
					(payload.source || "project") as "global" | "project",
				)

				if (result.success) {
					const customModes = await loadAndMergeModes(requireContext())
					await getVscodeContext().updateGlobalState("customModes", customModes)
					await postStateToWebview(provider)
					provider.postMessageToWebview({
						type: "importModeResult",
						success: true,
						slug: result.slug,
					})

					vscode.window.showInformationMessage(t("common:info.mode_imported"))
				} else {
					provider.postMessageToWebview({
						type: "importModeResult",
						success: false,
						error: result.error,
					})

					vscode.window.showErrorMessage(t("common:errors.mode_import_failed", { error: result.error }))
				}
			} else {
				provider.postMessageToWebview({
					type: "importModeResult",
					success: false,
					error: "cancelled",
				})
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			EventBridge.outputChannel?.appendLine(`Failed to import mode: ${errorMessage}`)
			provider.postMessageToWebview({
				type: "importModeResult",
				success: false,
				error: errorMessage,
			})

			vscode.window.showErrorMessage(t("common:errors.mode_import_failed", { error: errorMessage }))
		}
	})

	// ── checkRulesDirectory ───────────────────────────────────────────
	bus.register(IntentType.SettingsModeRulesDirectoryCheck, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { slug: string }
		if (!payload.slug) return

		const hasContent = await checkRulesDirectoryHasContent(payload.slug)

		provider.postMessageToWebview({
			type: "checkRulesDirectoryResult",
			slug: payload.slug,
			hasContent,
		})
	})

	// ── hasOpenedModeSelector ─────────────────────────────────────────
	bus.register(IntentType.SettingsModeSelectorOpened, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { bool: boolean }
		await getVscodeContext().updateGlobalState("hasOpenedModeSelector", payload.bool ?? true)
		await postStateToWebview(provider)
	})

	// ── requestModes ──────────────────────────────────────────────────
	bus.register(IntentType.SettingsModesRequest, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		try {
			const customModes = ctx.rootStore.settings.modes.customModes as ModeConfig[]
			const modes = getAllModes(customModes) as { slug: string; name: string }[]
			await provider.postMessageToWebview({ type: "modes", modes })
		} catch (error) {
			EventBridge.outputChannel?.appendLine(
				`Error fetching modes: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
			)
			await provider.postMessageToWebview({ type: "modes", modes: [] })
		}
	})

	// ── openCustomModesSettings ───────────────────────────────────────
	bus.register(IntentType.SettingsModeCustomSettingsOpen, async () => {
		const customModesFilePath = await getCustomModesFilePath(requireContext())

		if (customModesFilePath) {
			openFile(customModesFilePath)
		}
	})
}
