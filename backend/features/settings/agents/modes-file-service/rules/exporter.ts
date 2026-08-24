import * as path from "path"
import * as fs from "fs/promises"

import * as yaml from "yaml"

import { type ModeConfig, type PromptComponent } from "@jabberwock/types"

import { fileExistsAtPath } from "@utils/io/fs"
import { getWorkspacePath } from "@utils/io/path"
import { getGlobalRooDirectory } from "@services/jabberwock-config"
import { logger } from "@utils/logging"

import {
	type ExportedModeConfig,
	type ExportResult,
	type RuleFile,
	JABBERWOCKMODES_FILENAME,
} from "@features/settings/agents/modes-file-service/types"
import { createMockExtensionContext } from "@features/settings/agents/modes-file-service/mock"
import { loadAndMergeModes } from "@features/settings/agents/modes-file-service/file-ops"
import { modes as builtInModes } from "@shared/modes"

async function findModeForExport(slug: string): Promise<ModeConfig | undefined> {
	const allModes = await loadAndMergeModes(createMockExtensionContext())
	let mode = allModes.find((m) => m.slug === slug)
	if (mode) {
		return mode
	}

	const workspacePath = getWorkspacePath()
	if (workspacePath) {
		const roomodesPath = path.join(workspacePath, JABBERWOCKMODES_FILENAME)
		try {
			const roomodesExists = await fileExistsAtPath(roomodesPath)
			if (roomodesExists) {
				const roomodesContent = await fs.readFile(roomodesPath, "utf-8")
				const roomodesData = yaml.parse(roomodesContent)
				const roomodesModes: ModeConfig[] = roomodesData?.customModes || []
				mode = roomodesModes.find((m: ModeConfig) => m.slug === slug)
				if (mode) {
					return mode
				}
			}
		} catch {
			// Continue
		}
	}

	const builtInMode = builtInModes.find((m) => m.slug === slug)
	if (builtInMode) {
		return { ...builtInMode }
	}
	return undefined
}

async function collectRuleFiles(modeRulesDir: string): Promise<RuleFile[]> {
	const rulesFiles: RuleFile[] = []
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
	} catch {
		// Directory doesn't exist
	}
	return rulesFiles
}

function buildExportedModeConfig(
	mode: ModeConfig,
	rulesFiles: RuleFile[],
	customPrompts?: PromptComponent,
): ExportedModeConfig {
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

	return exportMode
}

/**
 * Export a mode configuration with its associated rules files into YAML
 */
export async function exportModeWithRules(slug: string, customPrompts?: PromptComponent): Promise<ExportResult> {
	try {
		const mode = await findModeForExport(slug)
		if (!mode) {
			return { success: false, error: "Mode not found" }
		}

		const isGlobalMode = mode.source === "global"
		const baseDir = isGlobalMode ? getGlobalRooDirectory() : getWorkspacePath()
		if (!isGlobalMode && !baseDir) {
			return { success: false, error: "No workspace found" }
		}

		const modeRulesDir = isGlobalMode
			? path.join(baseDir!, `rules-${slug}`)
			: path.join(baseDir!, ".jabberwock", `rules-${slug}`)

		const rulesFiles = await collectRuleFiles(modeRulesDir)

		const exportMode = buildExportedModeConfig(mode, rulesFiles, customPrompts)

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
