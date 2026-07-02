import * as path from "path"
import * as fs from "fs/promises"

import * as yaml from "yaml"

import { modeConfigSchema } from "@jabberwock/types"

import { getWorkspacePath } from "@utils/io/path"
import { logger } from "@utils/logging"

import {
	type ExportedModeConfig,
	type ImportData,
	type ImportResult,
	type RuleFile,
} from "@features/settings/agents/modes-file-service/types"
import { createMockExtensionContext } from "@features/settings/agents/modes-file-service/mock"
import { loadAndMergeModes } from "@features/settings/agents/modes-file-service/file-ops"
import {
	getRulesBaseDir,
	hasNoValidRules,
	isIncompleteRuleFile,
	isInvalidImportPath,
	isPathTraversalSafe,
} from "./utils"
import { updateCustomModeInFile } from "@features/settings/agents/modes-file-service/crud"

function parseImportYamlContent(yamlContent: string): ImportData {
	const parsed = yaml.parse(yamlContent)
	if (!parsed?.customModes || !Array.isArray(parsed.customModes) || parsed.customModes.length === 0) {
		throw new Error("Invalid import format: Expected 'customModes' array in YAML")
	}
	return parsed as ImportData
}

async function processSingleImportMode(importMode: ExportedModeConfig, source: "global" | "project"): Promise<void> {
	const { rulesFiles, ...modeConfig } = importMode

	const validationResult = modeConfigSchema.safeParse(modeConfig)
	if (!validationResult.success) {
		logger.error(`Invalid mode configuration for ${modeConfig.slug}`, {
			errors: validationResult.error.errors,
		})
		throw new Error(
			`Invalid mode configuration for ${modeConfig.slug}: ${validationResult.error.errors.map((e) => e.message).join(", ")}`,
		)
	}

	const context = createMockExtensionContext()
	const existingModes = await loadAndMergeModes(context)
	const existingMode = existingModes.find((m) => m.slug === importMode.slug)
	if (existingMode) {
		logger.info(`Overwriting existing mode: ${importMode.slug}`)
	}

	await updateCustomModeInFile(
		importMode.slug,
		{
			...modeConfig,
			source,
		},
		context,
	)

	await importRulesFiles(importMode, rulesFiles || [], source)
}

/**
 * Import rules files for a mode
 */
export async function importRulesFiles(
	importMode: ExportedModeConfig,
	rulesFiles: RuleFile[],
	source: "global" | "project",
): Promise<void> {
	const rulesFolderPath = getRulesBaseDir(source, importMode.slug)

	try {
		await fs.rm(rulesFolderPath, { recursive: true, force: true })
		logger.info(`Removed existing ${source} rules folder for mode ${importMode.slug}`)
	} catch {
		logger.debug(`No existing ${source} rules folder to remove for mode ${importMode.slug}`)
	}

	if (hasNoValidRules(rulesFiles)) {
		return
	}

	for (const ruleFile of rulesFiles) {
		if (isIncompleteRuleFile(ruleFile)) {
			continue
		}

		const normalizedRelativePath = path.normalize(ruleFile.relativePath)

		if (isInvalidImportPath(normalizedRelativePath)) {
			logger.error(`Invalid file path detected: ${ruleFile.relativePath}`)
			continue
		}

		const cleanedRelativePath = normalizedRelativePath.replace(/^rules\//, "")

		const targetPath = path.join(rulesFolderPath, cleanedRelativePath)
		if (!isPathTraversalSafe(targetPath, rulesFolderPath)) {
			logger.error(`Path traversal attempt detected: ${ruleFile.relativePath}`)
			continue
		}

		const targetDir = path.dirname(targetPath)
		await fs.mkdir(targetDir, { recursive: true })
		await fs.writeFile(targetPath, ruleFile.content, "utf-8")
	}
}

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
			importData = parseImportYamlContent(yamlContent)
		} catch (parseError) {
			return {
				success: false,
				error: `Invalid YAML format: ${parseError instanceof Error ? parseError.message : "Failed to parse YAML"}`,
			}
		}

		if (source === "project" && !getWorkspacePath()) {
			return { success: false, error: "No workspace found" }
		}

		for (const importMode of importData.customModes) {
			await processSingleImportMode(importMode, source)
		}

		const context = createMockExtensionContext()
		await loadAndMergeModes(context)

		return { success: true, slug: importData.customModes[0]?.slug }
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		logger.error("Failed to import mode with rules", { error: errorMessage })
		return { success: false, error: errorMessage }
	}
}
