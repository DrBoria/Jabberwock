import * as path from "path"
import { promises as fs } from "fs"
import { exec } from "child_process"
import { promisify } from "util"

import { convertGitUrlToHttps } from "./url"
import { sanitizeGitUrl } from "./url"
import { extractRepositoryName } from "./url"

export const execAsync = promisify(exec)

export const GIT_OUTPUT_LINE_LIMIT = 500

/**
 * Extracts git repository information from the workspace's .git directory
 * @param gitDir The path to the .git directory
 * @returns Git repository information or empty object if not a git repository
 */
export async function readGitConfig(
	gitDir: string,
): Promise<{ repositoryUrl?: string; repositoryName?: string; defaultBranch?: string }> {
	try {
		const configPath = path.join(gitDir, "config")
		const configContent = await fs.readFile(configPath, "utf8")
		const result: { repositoryUrl?: string; repositoryName?: string; defaultBranch?: string } = {}

		const urlMatch = configContent.match(/url\s*=\s*(.+?)(?:\r?\n|$)/m)
		if (urlMatch?.[1]) {
			const url = urlMatch[1].trim()
			result.repositoryUrl = convertGitUrlToHttps(sanitizeGitUrl(url))
			const repositoryName = extractRepositoryName(url)
			if (repositoryName) {
				result.repositoryName = repositoryName
			}
		}

		const branchMatch = configContent.match(/\[branch "([^"]+)"\]/i)
		if (branchMatch?.[1]) {
			result.defaultBranch = branchMatch[1]
		}

		return result
	} catch {
		return {}
	}
}

export async function readGitHead(gitDir: string): Promise<string | undefined> {
	try {
		const headPath = path.join(gitDir, "HEAD")
		const headContent = await fs.readFile(headPath, "utf8")
		const branchMatch = headContent.match(/ref: refs\/heads\/(.+)/)
		return branchMatch?.[1]?.trim()
	} catch {
		return undefined
	}
}

export async function checkGitRepo(cwd: string): Promise<boolean> {
	try {
		await execAsync("git rev-parse --git-dir", { cwd })
		return true
	} catch {
		return false
	}
}

export async function checkGitInstalled(): Promise<boolean> {
	try {
		await execAsync("git --version")
		return true
	} catch {
		return false
	}
}
