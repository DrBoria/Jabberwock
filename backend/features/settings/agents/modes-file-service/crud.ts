// v4 B2 (L3/L14): structural host-context view instead of the vscode ExtensionContext type.
import type { IExtensionContextView } from "@features/foundation/vscode/context"
// v4 B2 (L4): workspace roots come from the host context DI slot, not vscode directly.
import { getWorkspaceRoots } from "@features/foundation/vscode/context"
import * as path from "path"
import * as fs from "fs/promises"

import * as yaml from "yaml"

import { type ModeConfig, modeConfigSchema } from "@jabberwock/types"

import { getBackendRootStore } from "@features/storeSingleton"
import { getWorkspacePath } from "@utils/io/path"
import { logger } from "@utils/logging"
import { t } from "@i18n"

import { JABBERWOCKMODES_FILENAME } from "./types"
import { getCustomModesFilePath, getWorkspaceRoomodes, loadModesFromFile, updateModesInFile } from "./file-ops"
import { deleteRulesFolder } from "./rules/utils"

/**
 * Update or create a custom mode in the appropriate file
 */
export async function updateCustomModeInFile(
	slug: string,
	config: ModeConfig,
	context: IExtensionContextView,
): Promise<void> {
	const validationResult = modeConfigSchema.safeParse(config)
	if (!validationResult.success) {
		const errorMessages = validationResult.error.errors
			.map((err) => `${err.path.join(".")}: ${err.message}`)
			.join(", ")
		const errorMessage = `Invalid mode configuration: ${errorMessages}`
		logger.error("Mode validation failed", { slug, errors: validationResult.error.errors })
		publishNotificationError(t("common:customModes.errors.updateFailed", { error: errorMessage }))
		throw new Error(errorMessage)
	}

	const isProjectMode = config.source === "project"
	let targetPath: string

	if (isProjectMode) {
		const workspaceRoots = getWorkspaceRoots()

		if (workspaceRoots.length === 0) {
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

/**
 * Delete a custom mode from the appropriate file(s)
 */
export async function deleteCustomModeFromFile(
	slug: string,
	context: IExtensionContextView,
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

/**
 * Reset custom modes by clearing the settings file
 */
export async function resetCustomModesInFile(context: IExtensionContextView): Promise<void> {
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

import { publishNotificationError } from "@features/foundation/capabilities/notifications"
