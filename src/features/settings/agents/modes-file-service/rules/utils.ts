import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import * as os from "os"

import * as yaml from "yaml"

import { type ModeConfig } from "@jabberwock/types"

import { fileExistsAtPath } from "@utils/io/fs"
import { getWorkspacePath } from "@utils/io/path"
import { getGlobalRooDirectory } from "@services/jabberwock-config"
import { logger } from "@utils/logging"
import { t } from "@i18n"

import { type RuleFile, JABBERWOCKMODES_FILENAME } from "@features/settings/agents/modes-file-service/types"
import { createMockExtensionContext } from "@features/settings/agents/modes-file-service/mock"
import { loadAndMergeModes } from "@features/settings/agents/modes-file-service/file-ops"

export function hasNoValidRules(rulesFiles: RuleFile[] | undefined): boolean {
	return !rulesFiles || !Array.isArray(rulesFiles) || rulesFiles.length === 0
}

export function isIncompleteRuleFile(ruleFile: RuleFile): boolean {
	return !ruleFile.relativePath || !ruleFile.content
}

export function isInvalidImportPath(relativePath: string): boolean {
	const normalized = path.normalize(relativePath)
	return normalized.includes("..") || path.isAbsolute(normalized)
}

/**
 * Resolve the rules folder path for a custom mode based on its source scope.
 */
function getCustomModeRulesFolderPath(slug: string, source?: string): string {
	if (source === "project") {
		const workspacePath = getWorkspacePath()
		if (workspacePath) {
			return path.join(workspacePath, ".jabberwock", `rules-${slug}`)
		}
		return path.join(".jabberwock", `rules-${slug}`)
	}
	const homeDir = os.homedir()
	return path.join(homeDir, ".jabberwock", `rules-${slug}`)
}

/**
 * Delete the rules folder for a custom mode.
 */
export async function deleteRulesFolder(slug: string, mode: ModeConfig, fromMarketplace = false): Promise<void> {
	if (fromMarketplace) {
		const homeDir = os.homedir()
		const rulesFolderPath = path.join(homeDir, ".jabberwock", `rules-${slug}`)
		try {
			await fs.rm(rulesFolderPath, { recursive: true, force: true })
		} catch {
			// Folder may not exist, ignore
		}
		return
	}

	const rulesFolderPath = getCustomModeRulesFolderPath(slug, mode.source)
	try {
		await fs.rm(rulesFolderPath, { recursive: true, force: true })
	} catch {
		// Folder may not exist, ignore
	}
}

/**
 * Check if a custom mode's rules directory has any content.
 */
export async function checkRulesDirectoryHasContent(slug: string): Promise<boolean> {
	const homeDir = os.homedir()
	const globalPath = path.join(homeDir, ".jabberwock", `rules-${slug}`)
	const exists = await fileExistsAtPath(globalPath)
	if (!exists) {
		return false
	}

	try {
		const entries = await fs.readdir(globalPath)
		return entries.length > 0
	} catch {
		return false
	}
}

export function getRulesBaseDir(source: "global" | "project", slug: string): string {
	if (source === "project") {
		const workspacePath = getWorkspacePath()
		if (workspacePath) {
			return path.join(workspacePath, ".jabberwock", `rules-${slug}`)
		}
		return path.join(".jabberwock", `rules-${slug}`)
	}
	const homeDir = os.homedir()
	return path.join(homeDir, ".jabberwock", `rules-${slug}`)
}

export function isPathTraversalSafe(targetPath: string, basePath: string): boolean {
	const normalizedTarget = path.resolve(targetPath)
	const normalizedBase = path.resolve(basePath)
	return normalizedTarget.startsWith(normalizedBase)
}
