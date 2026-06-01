import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import * as os from "os"

import * as yaml from "yaml"
import stripBom from "strip-bom"

import { type ModeConfig, type PromptComponent, customModesSettingsSchema, modeConfigSchema } from "@jabberwock/types"

import { fileExistsAtPath } from "../../../utils/fs"
import { getBackendRootStore } from "@features/storeSingleton"
import { getWorkspacePath } from "../../../utils/path"
import { getGlobalRooDirectory } from "../../../services/jabberwock-config"
import { logger } from "../../../utils/logging"
import { GlobalFileNames } from "../../../shared/globalFileNames"
import { ensureSettingsDirectoryExists } from "../../../utils/globalContext"
import { t } from "../../../i18n"

// ─── Mock context factory for read-only operations ──────────────
// Used when we only need globalState for loading/merging modes without
// a real vscode.ExtensionContext (e.g., in export/import operations).

/**
 * Create a minimal ExtensionContext mock with only the properties needed
 * for mode loading and merging operations.
 * Note: callers should not invoke ensureSettingsDirectoryExists on this mock.
 */
function createMockExtensionContext(): vscode.ExtensionContext {
	const mockSecretStorage: vscode.SecretStorage = {
		get: async () => undefined,
		store: async () => {},
		delete: async () => {},
		onDidChange: () => ({ dispose: () => {} }),
	}
	const mockMemento = {
		get: <T>(_key: string): T | undefined => undefined,
		update: async () => {},
		keys: (): readonly string[] => [],
		setKeysForSync: (_keys: readonly string[]): void => {},
	}
	const mockEnvCollection = {
		replace: () => {},
		append: () => {},
		prepend: () => {},
		get: () => undefined,
		forEach: () => {},
		delete: () => {},
		clear: () => {},
		persistent: false,
		description: "",
		[Symbol.iterator]: () => [][Symbol.iterator](),
		getScoped: () => mockEnvCollection,
	}
	const mockExtension: vscode.Extension<unknown> = {
		id: "",
		extensionUri: vscode.Uri.parse(""),
		extensionPath: "",
		isActive: false,
		packageJSON: {},
		extensionKind: vscode.ExtensionKind.UI,
		exports: undefined,
		activate: () => Promise.resolve(undefined),
	}
	const mockLanguageModelAccess: vscode.LanguageModelAccessInformation = {
		onDidChange: () => ({ dispose: () => {} }),
		canSendRequest: () => undefined,
	}

	return {
		subscriptions: [],
		extensionPath: "",
		extensionUri: vscode.Uri.parse(""),
		storagePath: undefined,
		globalStoragePath: "",
		logPath: "",
		extensionMode: vscode.ExtensionMode.Test,
		logUri: vscode.Uri.parse(""),
		storageUri: undefined,
		globalStorageUri: vscode.Uri.parse(""),
		asAbsolutePath: (path: string) => path,
		secrets: mockSecretStorage,
		environmentVariableCollection: mockEnvCollection,
		extension: mockExtension,
		languageModelAccessInformation: mockLanguageModelAccess,
		globalState: mockMemento as vscode.Memento & { setKeysForSync(keys: readonly string[]): void },
		workspaceState: mockMemento as vscode.Memento,
	}
}

// ─── Extension context reference ─────────────────────────────────────
// Set once during extension activation; used by functions that need
// vscode.ExtensionContext for file path resolution and globalState.
// This follows the same pattern as ContextProxy.instance.

let _extensionContext: vscode.ExtensionContext | undefined

/**
 * Initialize the modes file service with the extension context.
 * Must be called once during extension activation (extension.ts).
 */
export function initModesFileService(context: vscode.ExtensionContext): void {
	_extensionContext = context
}

export function requireContext(): vscode.ExtensionContext {
	if (!_extensionContext) {
		throw new Error(
			"modesFileService not initialized. Call initModesFileService(context) during extension activation.",
		)
	}
	return _extensionContext
}
export const JABBERWOCKMODES_FILENAME = ".jabberwockmodes"

export const CACHE_TTL = 10_000

// ─── Type definitions for import/export functionality ───────────────

export interface RuleFile {
	relativePath: string
	content: string
}

export interface ExportedModeConfig extends ModeConfig {
	rulesFiles?: RuleFile[]
}

export interface ImportData {
	customModes: ExportedModeConfig[]
}

export interface ExportResult {
	success: boolean
	yaml?: string
	error?: string
}

export interface ImportResult {
	success: boolean
	slug?: string
	error?: string
}

/**
 * Regex pattern for problematic characters that need to be cleaned from YAML content
 */
const PROBLEMATIC_CHARS_REGEX =
	/[\u00A0\u2010\u2011\u2012\u2013\u2014\u2015\u2212\u2018\u2019\u201C\u201D]|[\u200B\u200C\u200D]/gu

// ─── Character cleaning ─────────────────────────────────────────────

/**
 * Clean invisible and problematic characters from YAML content
 */
export function cleanInvisibleCharacters(content: string): string {
	return content.replace(PROBLEMATIC_CHARS_REGEX, (match) => {
		switch (match) {
			case "\u00A0":
				return " "
			case "\u200B":
			case "\u200C":
			case "\u200D":
				return ""
			case "\u2018":
			case "\u2019":
				return "'"
			case "\u201C":
			case "\u201D":
				return '"'
			default:
				return "-"
		}
	})
}

// ─── YAML parsing ───────────────────────────────────────────────────

/**
 * Parse YAML content with enhanced error handling and preprocessing
 */
export function parseYamlSafely(content: string, filePath: string): unknown {
	let cleanedContent = stripBom(content)
	cleanedContent = cleanInvisibleCharacters(cleanedContent)

	try {
		const parsed = yaml.parse(cleanedContent)
		return parsed ?? {}
	} catch (yamlError) {
		if (filePath.endsWith(JABBERWOCKMODES_FILENAME)) {
			try {
				return JSON.parse(content)
			} catch (jsonError) {
				const errorMsg = yamlError instanceof Error ? yamlError.message : String(yamlError)
				console.error(`[jabberwock] [modesFileService] Failed to parse YAML from ${filePath}:`, errorMsg)

				const lineMatch = errorMsg.match(/at line (\d+)/)
				const line = lineMatch ? lineMatch[1] : "unknown"
				vscode.window.showErrorMessage(t("common:customModes.errors.yamlParseError", { line }))

				return {}
			}
		}

		const errorMsg = yamlError instanceof Error ? yamlError.message : String(yamlError)
		console.error(`[jabberwock] [modesFileService] Failed to parse YAML from ${filePath}:`, errorMsg)
		return {}
	}
}

// ─── File loading ───────────────────────────────────────────────────

/**
 * Load custom modes from a YAML file path
 */
export async function loadModesFromFile(filePath: string): Promise<ModeConfig[]> {
	try {
		const content = await fs.readFile(filePath, "utf-8")
		const settings = parseYamlSafely(content, filePath)

		if (!settings || typeof settings !== "object" || !("customModes" in (settings as { [key: string]: unknown }))) {
			return []
		}

		const result = customModesSettingsSchema.safeParse(settings)

		if (!result.success) {
			console.error(`[jabberwock] [modesFileService] Schema validation failed for ${filePath}:`, result.error)

			if (filePath.endsWith(JABBERWOCKMODES_FILENAME)) {
				const issues = result.error.issues
					.map((issue) => `• ${issue.path.join(".")}: ${issue.message}`)
					.join("\n")

				vscode.window.showErrorMessage(t("common:customModes.errors.schemaValidationError", { issues }))
			}

			return []
		}

		const isRoomodes = filePath.endsWith(JABBERWOCKMODES_FILENAME)
		const source = isRoomodes ? ("project" as const) : ("global" as const)

		return result.data.customModes.map((mode) => ({ ...mode, source }))
	} catch (error) {
		if (!(error as { [key: string]: unknown }).alreadyHandled) {
			const errorMsg = `Failed to load modes from ${filePath}: ${error instanceof Error ? error.message : String(error)}`
			console.error(`[jabberwock] [modesFileService] ${errorMsg}`)
		}
		return []
	}
}

// ─── Merging ────────────────────────────────────────────────────────

/**
 * Merge project modes (takes precedence) and global modes (no duplicates)
 */
export function mergeCustomModes(projectModes: ModeConfig[], globalModes: ModeConfig[]): ModeConfig[] {
	const slugs = new Set<string>()
	const merged: ModeConfig[] = []

	for (const mode of projectModes) {
		if (!slugs.has(mode.slug)) {
			slugs.add(mode.slug)
			merged.push({ ...mode, source: "project" })
		}
	}

	for (const mode of globalModes) {
		if (!slugs.has(mode.slug)) {
			slugs.add(mode.slug)
			merged.push({ ...mode, source: "global" })
		}
	}

	return merged
}

// ─── File path resolution ───────────────────────────────────────────

/**
 * Get or create the custom modes settings file path
 */
export async function getCustomModesFilePath(context: vscode.ExtensionContext): Promise<string> {
	const settingsDir = await ensureSettingsDirectoryExists(context)
	const filePath = path.join(settingsDir, GlobalFileNames.customModes)
	const fileExists = await fileExistsAtPath(filePath)

	if (!fileExists) {
		await fs.writeFile(filePath, yaml.stringify({ customModes: [] }, { lineWidth: 0 }))
	}

	return filePath
}

/**
 * Get the path to the workspace-level .jabberwockmodes file, if it exists
 */
export async function getWorkspaceRoomodes(): Promise<string | undefined> {
	const workspaceFolders = vscode.workspace.workspaceFolders

	if (!workspaceFolders || workspaceFolders.length === 0) {
		return undefined
	}

	const workspaceRoot = getWorkspacePath()
	const roomodesPath = path.join(workspaceRoot, JABBERWOCKMODES_FILENAME)
	const exists = await fileExistsAtPath(roomodesPath)
	return exists ? roomodesPath : undefined
}

// ─── Read-modify-write utility ──────────────────────────────────────

/**
 * Read a YAML file, apply an operation to its modes array, and write back
 */
export async function updateModesInFile(
	filePath: string,
	operation: (modes: ModeConfig[]) => ModeConfig[],
): Promise<void> {
	let content = "{}"

	try {
		content = await fs.readFile(filePath, "utf-8")
	} catch (error) {
		content = yaml.stringify({ customModes: [] }, { lineWidth: 0 })
	}

	let settings

	try {
		settings = parseYamlSafely(content, filePath)
	} catch (error) {
		settings = { customModes: [] }
	}

	if (!settings || typeof settings !== "object") {
		settings = { customModes: [] }
	}
	const settingsObj = settings as { [key: string]: unknown }
	if (!settingsObj.customModes) {
		settingsObj.customModes = []
	}

	settingsObj.customModes = operation(settingsObj.customModes as ModeConfig[])
	await fs.writeFile(filePath, yaml.stringify(settings, { lineWidth: 0 }), "utf-8")
}

// ─── Async load (files → merged modes) ──────────────────────────────

/**
 * Load custom modes from both global settings file and workspace .jabberwockmodes,
 * merge them (project takes precedence), and persist to globalState.
 */
export async function loadAndMergeModes(context: vscode.ExtensionContext): Promise<ModeConfig[]> {
	const settingsPath = await getCustomModesFilePath(context)
	const settingsModes = settingsPath ? await loadModesFromFile(settingsPath) : []

	const roomodesPath = await getWorkspaceRoomodes()
	const roomodesModes = roomodesPath ? await loadModesFromFile(roomodesPath) : []

	const projectSlugs = new Set(roomodesModes.map((m) => m.slug))
	const mergedModes: ModeConfig[] = [
		...roomodesModes.map((mode) => ({ ...mode, source: "project" as const })),
		...settingsModes
			.filter((mode) => !projectSlugs.has(mode.slug))
			.map((mode) => ({ ...mode, source: "global" as const })),
	]

	await context.globalState.update("customModes", mergedModes)

	const store = getBackendRootStore().settings.modes as {
		setCustomModes(modes: ModeConfig[]): void
		setCachedAt(t: number): void
		setFilePath(p: string): void
	}
	store.setCustomModes(mergedModes)
	store.setCachedAt(Date.now())
	store.setFilePath(settingsPath)

	return mergedModes
}

// ─── Rules folder management ────────────────────────────────────────

/**
 * Deletes the rules folder for a specific mode
 */
export async function deleteRulesFolder(slug: string, mode: ModeConfig, fromMarketplace = false): Promise<void> {
	try {
		const scope = mode.source || "global"

		let rulesFolderPath: string
		if (scope === "project") {
			const workspacePath = getWorkspacePath()
			if (workspacePath) {
				rulesFolderPath = path.join(workspacePath, ".jabberwock", `rules-${slug}`)
			} else {
				return
			}
		} else {
			const homeDir = os.homedir()
			rulesFolderPath = path.join(homeDir, ".jabberwock", `rules-${slug}`)
		}

		const rulesFolderExists = await fileExistsAtPath(rulesFolderPath)
		if (rulesFolderExists) {
			try {
				await fs.rm(rulesFolderPath, { recursive: true, force: true })
				logger.info(`Deleted rules folder for mode ${slug}: ${rulesFolderPath}`)
			} catch (error) {
				logger.error(`Failed to delete rules folder for mode ${slug}: ${error}`)
				const messageKey = fromMarketplace
					? "common:marketplace.mode.rulesCleanupFailed"
					: "common:customModes.errors.rulesCleanupFailed"
				vscode.window.showWarningMessage(t(messageKey, { rulesFolderPath }))
			}
		}
	} catch (error) {
		logger.error(`Error deleting rules folder for mode ${slug}`, {
			error: error instanceof Error ? error.message : String(error),
		})
	}
}

/**
 * Import rules files for a mode
 */
export async function importRulesFiles(
	importMode: ExportedModeConfig,
	rulesFiles: RuleFile[],
	source: "global" | "project",
): Promise<void> {
	let baseDir: string
	let rulesFolderPath: string

	if (source === "global") {
		baseDir = getGlobalRooDirectory()
		rulesFolderPath = path.join(baseDir, `rules-${importMode.slug}`)
	} else {
		const workspacePath = getWorkspacePath()
		baseDir = path.join(workspacePath, ".jabberwock")
		rulesFolderPath = path.join(baseDir, `rules-${importMode.slug}`)
	}

	try {
		await fs.rm(rulesFolderPath, { recursive: true, force: true })
		logger.info(`Removed existing ${source} rules folder for mode ${importMode.slug}`)
	} catch (error) {
		logger.debug(`No existing ${source} rules folder to remove for mode ${importMode.slug}`)
	}

	if (!rulesFiles || !Array.isArray(rulesFiles) || rulesFiles.length === 0) {
		return
	}

	for (const ruleFile of rulesFiles) {
		if (ruleFile.relativePath && ruleFile.content) {
			const normalizedRelativePath = path.normalize(ruleFile.relativePath)

			if (normalizedRelativePath.includes("..") || path.isAbsolute(normalizedRelativePath)) {
				logger.error(`Invalid file path detected: ${ruleFile.relativePath}`)
				continue
			}

			let cleanedRelativePath = normalizedRelativePath
			const rulesMatch = normalizedRelativePath.match(/^rules-[^\/\\]+[\/\\]/)
			if (rulesMatch) {
				cleanedRelativePath = normalizedRelativePath.substring(rulesMatch[0].length)
				logger.info(`Detected old export format, stripping ${rulesMatch[0]} from path`)
			}

			const targetPath = path.join(rulesFolderPath, cleanedRelativePath)
			const normalizedTargetPath = path.normalize(targetPath)
			const expectedBasePath = path.normalize(rulesFolderPath)

			if (!normalizedTargetPath.startsWith(expectedBasePath)) {
				logger.error(`Path traversal attempt detected: ${ruleFile.relativePath}`)
				continue
			}

			const targetDir = path.dirname(targetPath)
			await fs.mkdir(targetDir, { recursive: true })
			await fs.writeFile(targetPath, ruleFile.content, "utf-8")
		}
	}
}

// ─── Check rules directory content ──────────────────────────────────

/**
 * Check if a mode has rules files in its rules directory
 */
export async function checkRulesDirectoryHasContent(slug: string): Promise<boolean> {
	try {
		const allModes = await loadAndMergeModes(createMockExtensionContext())
		const mode = allModes.find((m) => m.slug === slug)

		if (!mode) {
			const workspacePath = getWorkspacePath()
			if (!workspacePath) {
				return false
			}

			const roomodesPath = path.join(workspacePath, JABBERWOCKMODES_FILENAME)
			try {
				const roomodesExists = await fileExistsAtPath(roomodesPath)
				if (roomodesExists) {
					const roomodesContent = await fs.readFile(roomodesPath, "utf-8")
					const roomodesData = yaml.parse(roomodesContent)
					const roomodesModes = roomodesData?.customModes || []

					const modeInRoomodes = roomodesModes.find((m: { slug: string }) => m.slug === slug)
					if (!modeInRoomodes) {
						return false
					}
				} else {
					return false
				}
			} catch (error) {
				return false
			}
		}

		let modeRulesDir: string
		const isGlobalMode = mode?.source === "global"

		if (isGlobalMode) {
			const globalRooDir = getGlobalRooDirectory()
			modeRulesDir = path.join(globalRooDir, `rules-${slug}`)
		} else {
			const workspacePath = getWorkspacePath()
			if (!workspacePath) {
				return false
			}
			modeRulesDir = path.join(workspacePath, ".jabberwock", `rules-${slug}`)
		}

		try {
			const stats = await fs.stat(modeRulesDir)
			if (!stats.isDirectory()) {
				return false
			}
		} catch (error) {
			return false
		}

		try {
			const entries = await fs.readdir(modeRulesDir, { withFileTypes: true })

			for (const entry of entries) {
				if (entry.isFile()) {
					const filePath = path.join(modeRulesDir, entry.name)
					const content = await fs.readFile(filePath, "utf-8")
					if (content.trim()) {
						return true
					}
				}
			}

			return false
		} catch (error) {
			return false
		}
	} catch (error) {
		logger.error("Failed to check rules directory for mode", {
			slug,
			error: error instanceof Error ? error.message : String(error),
		})
		return false
	}
}

// ─── Export mode with rules ─────────────────────────────────────────

/**
 * Export a mode configuration with its associated rules files into YAML
 */
export async function exportModeWithRules(slug: string, customPrompts?: PromptComponent): Promise<ExportResult> {
	try {
		const { modes: builtInModes } = await import("../../../shared/modes")

		const allModes = await loadAndMergeModes(createMockExtensionContext())
		let mode = allModes.find((m) => m.slug === slug)

		if (!mode) {
			const workspacePath = getWorkspacePath()
			if (workspacePath) {
				const roomodesPath = path.join(workspacePath, JABBERWOCKMODES_FILENAME)
				try {
					const roomodesExists = await fileExistsAtPath(roomodesPath)
					if (roomodesExists) {
						const roomodesContent = await fs.readFile(roomodesPath, "utf-8")
						const roomodesData = yaml.parse(roomodesContent)
						const roomodesModes = roomodesData?.customModes || []
						mode = roomodesModes.find((m: { slug: string }) => m.slug === slug)
					}
				} catch (error) {
					// Continue
				}
			}

			if (!mode) {
				const builtInMode = builtInModes.find((m) => m.slug === slug)
				if (builtInMode) {
					mode = { ...builtInMode }
				} else {
					return { success: false, error: "Mode not found" }
				}
			}
		}

		const isGlobalMode = mode.source === "global"
		let baseDir: string
		if (isGlobalMode) {
			baseDir = getGlobalRooDirectory()
		} else {
			const workspacePath = getWorkspacePath()
			if (!workspacePath) {
				return { success: false, error: "No workspace found" }
			}
			baseDir = workspacePath
		}

		const modeRulesDir = isGlobalMode
			? path.join(baseDir, `rules-${slug}`)
			: path.join(baseDir, ".jabberwock", `rules-${slug}`)

		let rulesFiles: RuleFile[] = []
		try {
			const stats = await fs.stat(modeRulesDir)
			if (stats.isDirectory()) {
				const entries = await fs.readdir(modeRulesDir, { withFileTypes: true })

				for (const entry of entries) {
					if (entry.isFile()) {
						const filePath = path.join(modeRulesDir, entry.name)
						const content = await fs.readFile(filePath, "utf-8")
						if (content.trim()) {
							const relativePath = path.relative(modeRulesDir, filePath)
							const normalizedRelativePath = relativePath.replace(/\\/g, "/")
							rulesFiles.push({ relativePath: normalizedRelativePath, content: content.trim() })
						}
					}
				}
			}
		} catch (error) {
			// Directory doesn't exist
		}

		const exportMode: ExportedModeConfig = {
			...mode,
			source: "project" as const,
		}

		if (customPrompts) {
			if (customPrompts.roleDefinition) exportMode.roleDefinition = customPrompts.roleDefinition
			if (customPrompts.description) exportMode.description = customPrompts.description
			if (customPrompts.whenToUse) exportMode.whenToUse = customPrompts.whenToUse
			if (customPrompts.customInstructions) exportMode.customInstructions = customPrompts.customInstructions
		}

		if (rulesFiles.length > 0) {
			exportMode.rulesFiles = rulesFiles
		}

		const exportData = {
			customModes: [exportMode],
		}

		const yamlContent = yaml.stringify(exportData)

		return { success: true, yaml: yamlContent }
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		logger.error("Failed to export mode with rules", { slug, error: errorMessage })
		return { success: false, error: errorMessage }
	}
}

// ─── Import mode with rules ─────────────────────────────────────────

/**
 * Import a mode from YAML content with its associated rules files
 */
export async function importModeWithRules(
	yamlContent: string,
	source: "global" | "project" = "project",
): Promise<ImportResult> {
	try {
		let importData: ImportData
		try {
			const parsed = yaml.parse(yamlContent)

			if (!parsed?.customModes || !Array.isArray(parsed.customModes) || parsed.customModes.length === 0) {
				return { success: false, error: "Invalid import format: Expected 'customModes' array in YAML" }
			}

			importData = parsed as ImportData
		} catch (parseError) {
			return {
				success: false,
				error: `Invalid YAML format: ${parseError instanceof Error ? parseError.message : "Failed to parse YAML"}`,
			}
		}

		if (source === "project") {
			const workspacePath = getWorkspacePath()
			if (!workspacePath) {
				return { success: false, error: "No workspace found" }
			}
		}

		const context = createMockExtensionContext()

		for (const importMode of importData.customModes) {
			const { rulesFiles, ...modeConfig } = importMode

			const validationResult = modeConfigSchema.safeParse(modeConfig)
			if (!validationResult.success) {
				logger.error(`Invalid mode configuration for ${modeConfig.slug}`, {
					errors: validationResult.error.errors,
				})
				return {
					success: false,
					error: `Invalid mode configuration for ${modeConfig.slug}: ${validationResult.error.errors.map((e) => e.message).join(", ")}`,
				}
			}

			const existingModes = await loadAndMergeModes(context)
			const existingMode = existingModes.find((m) => m.slug === importMode.slug)
			if (existingMode) {
				logger.info(`Overwriting existing mode: ${importMode.slug}`)
			}

			await updateCustomModeInFile(
				importMode.slug,
				{
					...modeConfig,
					source: source,
				},
				context,
			)

			await importRulesFiles(importMode, rulesFiles || [], source)
		}

		await loadAndMergeModes(context)

		return { success: true, slug: importData.customModes[0]?.slug }
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		logger.error("Failed to import mode with rules", { error: errorMessage })
		return { success: false, error: errorMessage }
	}
}

// ─── Update single mode ─────────────────────────────────────────────

/**
 * Update or create a custom mode in the appropriate file
 */
export async function updateCustomModeInFile(
	slug: string,
	config: ModeConfig,
	context: vscode.ExtensionContext,
): Promise<void> {
	const validationResult = modeConfigSchema.safeParse(config)
	if (!validationResult.success) {
		const errorMessages = validationResult.error.errors
			.map((err) => `${err.path.join(".")}: ${err.message}`)
			.join(", ")
		const errorMessage = `Invalid mode configuration: ${errorMessages}`
		logger.error("Mode validation failed", { slug, errors: validationResult.error.errors })
		vscode.window.showErrorMessage(t("common:customModes.errors.updateFailed", { error: errorMessage }))
		throw new Error(errorMessage)
	}

	const isProjectMode = config.source === "project"
	let targetPath: string

	if (isProjectMode) {
		const workspaceFolders = vscode.workspace.workspaceFolders

		if (!workspaceFolders || workspaceFolders.length === 0) {
			logger.error("Failed to update project mode: No workspace folder found", { slug })
			throw new Error(t("common:customModes.errors.noWorkspaceForProject"))
		}

		const workspaceRoot = getWorkspacePath()
		targetPath = path.join(workspaceRoot, JABBERWOCKMODES_FILENAME)
	} else {
		targetPath = await getCustomModesFilePath(context)
	}

	const modeWithSource = {
		...config,
		source: isProjectMode ? ("project" as const) : ("global" as const),
	}

	await updateModesInFile(targetPath, (modes) => {
		const updatedModes = modes.filter((m) => m.slug !== slug)
		updatedModes.push(modeWithSource)
		return updatedModes
	})
}

// ─── Delete single mode ─────────────────────────────────────────────

/**
 * Delete a custom mode from the appropriate file(s)
 */
export async function deleteCustomModeFromFile(
	slug: string,
	context: vscode.ExtensionContext,
	fromMarketplace = false,
): Promise<void> {
	const settingsPath = await getCustomModesFilePath(context)
	const roomodesPath = await getWorkspaceRoomodes()

	const settingsModes = await loadModesFromFile(settingsPath)
	const roomodesModes = roomodesPath ? await loadModesFromFile(roomodesPath) : []

	const projectMode = roomodesModes.find((m) => m.slug === slug)
	const globalMode = settingsModes.find((m) => m.slug === slug)

	if (!projectMode && !globalMode) {
		throw new Error(t("common:customModes.errors.modeNotFound"))
	}

	const modeToDelete = projectMode || globalMode

	if (projectMode && roomodesPath) {
		await updateModesInFile(roomodesPath, (modes) => modes.filter((m) => m.slug !== slug))
	}

	if (globalMode) {
		await updateModesInFile(settingsPath, (modes) => modes.filter((m) => m.slug !== slug))
	}

	if (modeToDelete) {
		await deleteRulesFolder(slug, modeToDelete, fromMarketplace)
	}
}

// ─── Reset custom modes ─────────────────────────────────────────────

/**
 * Reset custom modes by clearing the settings file
 */
export async function resetCustomModesInFile(context: vscode.ExtensionContext): Promise<void> {
	const filePath = await getCustomModesFilePath(context)
	await fs.writeFile(filePath, yaml.stringify({ customModes: [] }, { lineWidth: 0 }))
	await context.globalState.update("customModes", [])

	const store = getBackendRootStore().settings.modes as {
		setCustomModes(modes: ModeConfig[]): void
		setCachedAt(t: number): void
	}
	store.setCustomModes([])
	store.setCachedAt(0)
}
