import fs from "fs/promises"
import path from "path"

import { getAgentsDirectoriesForCwd } from "@services/jabberwock-config"

import { safeReadFile, resolveSymLink } from "./utils"

/**
 * Read content from an agent rules file (AGENTS.md, AGENT.md, etc.)
 * Handles symlink resolution.
 */
async function readAgentRulesFile(filePath: string): Promise<string> {
	let resolvedPath = filePath

	try {
		const stats = await fs.lstat(filePath)
		if (stats.isSymbolicLink()) {
			const fileInfo: Array<{
				originalPath: string
				resolvedPath: string
			}> = []

			await resolveSymLink(filePath, fileInfo, 0)

			if (fileInfo.length > 0) {
				resolvedPath = fileInfo[0].resolvedPath
			}
		}
	} catch (_err) {
		return ""
	}

	return safeReadFile(resolvedPath)
}

/**
 * Load AGENTS.md or AGENT.md file from a specific directory.
 * Checks for both AGENTS.md (standard) and AGENT.md (alternative).
 * Also loads AGENTS.local.md for personal overrides.
 */
export async function loadAgentRulesFileFromDirectory(
	directory: string,
	showPath: boolean = false,
	cwd?: string,
): Promise<string> {
	const filenames = ["AGENTS.md", "AGENT.md"]
	const results: string[] = []
	const displayPath = cwd ? path.relative(cwd, directory) : directory

	for (const filename of filenames) {
		try {
			const agentPath = path.join(directory, filename)
			const content = await readAgentRulesFile(agentPath)

			if (content) {
				const header = showPath
					? `# Agent Rules Standard (${filename}) from ${displayPath}:`
					: `# Agent Rules Standard (${filename}):`
				results.push(`${header}\n${content}`)
				break
			}
		} catch (_err) {
			// Silently ignore errors - agent rules files are optional
		}
	}

	try {
		const localFilename = "AGENTS.local.md"
		const localPath = path.join(directory, localFilename)
		const localContent = await readAgentRulesFile(localPath)

		if (localContent) {
			const localHeader = showPath
				? `# Agent Rules Local (${localFilename}) from ${displayPath}:`
				: `# Agent Rules Local (${localFilename}):`
			results.push(`${localHeader}\n${localContent}`)
		}
	} catch (_err) {
		// Silently ignore errors - local agent rules file is optional
	}

	return results.join("\n\n")
}

/**
 * Load AGENTS.md or AGENT.md file from the project root if it exists.
 * @deprecated Use loadAllAgentRulesFiles for loading from all directories
 */

/**
 * Load all AGENTS.md files from project root and optionally subdirectories.
 */
export async function loadAllAgentRulesFiles(cwd: string, enableSubfolderRules: boolean = false): Promise<string> {
	const agentRules: string[] = []

	if (!enableSubfolderRules) {
		const content = await loadAgentRulesFileFromDirectory(cwd, false, cwd)
		if (content && content.trim()) {
			agentRules.push(content.trim())
		}
		return agentRules.join("\n\n")
	}

	const directories = await getAgentsDirectoriesForCwd(cwd)

	for (const directory of directories) {
		const showPath = directory !== cwd
		const content = await loadAgentRulesFileFromDirectory(directory, showPath, cwd)
		if (content && content.trim()) {
			agentRules.push(content.trim())
		}
	}

	return agentRules.join("\n\n")
}
