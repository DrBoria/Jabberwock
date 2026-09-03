// v4 B2 (L3/L14): structural host-context view instead of the vscode ExtensionContext type.
import type { IExtensionContextView } from "@features/foundation/host-context/context"
// v4 B2 (L4): workspace roots come from the host context DI slot, not vscode directly.
import { getWorkspaceRoots } from "@features/foundation/host-context/context"
import * as path from "path"
import * as fs from "fs/promises"

import * as yaml from "yaml"

import { type ModeConfig, customModesSettingsSchema } from "@jabberwock/types"

import { fileExistsAtPath } from "@utils/io/fs"
import { getBackendRootStore } from "@features/storeSingleton"
import { getWorkspacePath } from "@utils/io/path"
import { GlobalFileNames } from "@shared/globalFileNames"
import { ensureSettingsDirectoryExists } from "@utils/globalContext"

import { JABBERWOCKMODES_FILENAME } from "./types"
import { parseYamlSafely } from "./yaml"
import { t } from "@i18n"

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

				publishNotificationError(t("common:customModes.errors.schemaValidationError", { issues }))
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

/**
 * Get or create the custom modes settings file path
 */
export async function getCustomModesFilePath(context: IExtensionContextView): Promise<string> {
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
	const workspaceRoots = getWorkspaceRoots()

	if (workspaceRoots.length === 0) {
		return undefined
	}

	const workspaceRoot = getWorkspacePath()
	const roomodesPath = path.join(workspaceRoot, JABBERWOCKMODES_FILENAME)
	const exists = await fileExistsAtPath(roomodesPath)
	return exists ? roomodesPath : undefined
}

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
	} catch (_error) {
		content = yaml.stringify({ customModes: [] }, { lineWidth: 0 })
	}

	let settings

	try {
		settings = parseYamlSafely(content, filePath)
	} catch (_error) {
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

/**
 * Load custom modes from both global settings file and workspace .jabberwockmodes,
 * merge them (project takes precedence), and persist to globalState.
 */
export async function loadAndMergeModes(context: IExtensionContextView): Promise<ModeConfig[]> {
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

import { publishNotificationError } from "@features/foundation/capabilities/notifications"
