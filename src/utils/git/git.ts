import * as vscode from "vscode"
import * as path from "path"
import { promises as fs } from "fs"

import { truncateOutput } from "@integrations/misc/extract-text/helpers"
import { execAsync, GIT_OUTPUT_LINE_LIMIT } from "./git.helpers"
import { checkGitRepo } from "./git.helpers"
import { readGitConfig } from "./git.helpers"
import { readGitHead } from "./git.helpers"
import { checkGitInstalled } from "./git.helpers"
import type { GitRepositoryInfo } from "@jabberwock/types"

/**
 * Extracts git repository information from the workspace's .git directory
 * @param workspaceRoot The root path of the workspace
 * @returns Git repository information or empty object if not a git repository
 */
export async function getGitRepositoryInfo(workspaceRoot: string): Promise<GitRepositoryInfo> {
	try {
		const gitDir = path.join(workspaceRoot, ".git")
		try {
			await fs.access(gitDir)
		} catch {
			return {}
		}

		const configInfo = await readGitConfig(gitDir)
		const defaultBranch = configInfo.defaultBranch || (await readGitHead(gitDir))

		return {
			repositoryUrl: configInfo.repositoryUrl,
			repositoryName: configInfo.repositoryName,
			defaultBranch,
		}
	} catch {
		return {}
	}
}

/**
 * Gets git repository information for the current VSCode workspace
 * @returns Git repository information or empty object if not available
 */
export async function getWorkspaceGitInfo(): Promise<GitRepositoryInfo> {
	const workspaceFolders = vscode.workspace.workspaceFolders
	if (!workspaceFolders || workspaceFolders.length === 0) {
		return {}
	}

	// Use the first workspace folder.
	const workspaceRoot = workspaceFolders[0].uri.fsPath
	return getGitRepositoryInfo(workspaceRoot)
}

export async function getWorkingState(cwd: string): Promise<string> {
	try {
		const isInstalled = await checkGitInstalled()
		if (!isInstalled) {
			return "Git is not installed"
		}

		const isRepo = await checkGitRepo(cwd)
		if (!isRepo) {
			return "Not a git repository"
		}

		// Get status of working directory
		const { stdout: status } = await execAsync("git status --short", { cwd })
		if (!status.trim()) {
			return "No changes in working directory"
		}

		// Get all changes (both staged and unstaged) compared to HEAD
		const { stdout: diff } = await execAsync("git diff HEAD", { cwd })
		const lineLimit = GIT_OUTPUT_LINE_LIMIT
		const output = `Working directory changes:\n\n${status}\n\n${diff}`.trim()
		return truncateOutput(output, lineLimit)
	} catch (error) {
		console.error("[jabberwock] Error getting working state:", error)
		return `Failed to get working state: ${error instanceof Error ? error.message : String(error)}`
	}
}

/**
 * Gets git status output with configurable file limit
 * @param cwd The working directory to check git status in
 * @param maxFiles Maximum number of file entries to include (0 = disabled)
 * @returns Git status string or null if not a git repository
 */
export async function getGitStatus(cwd: string, maxFiles: number = 20): Promise<string | null> {
	try {
		const isInstalled = await checkGitInstalled()
		if (!isInstalled) {
			return null
		}

		const isRepo = await checkGitRepo(cwd)
		if (!isRepo) {
			return null
		}

		// Use porcelain v1 format with branch info
		const { stdout } = await execAsync("git status --porcelain=v1 --branch", { cwd })

		if (!stdout.trim()) {
			return null
		}

		const lines = stdout.trim().split("\n")

		// First line is always branch info (e.g., "## main...origin/main")
		const branchLine = lines[0]
		const fileLines = lines.slice(1)

		// Build output with branch info and limited file entries
		const output: string[] = [branchLine]

		if (maxFiles > 0 && fileLines.length > 0) {
			const filesToShow = fileLines.slice(0, maxFiles)
			output.push(...filesToShow)

			// Add truncation notice if needed
			if (fileLines.length > maxFiles) {
				output.push(`... ${fileLines.length - maxFiles} more files`)
			}
		}

		return output.join("\n")
	} catch (error) {
		console.error("[jabberwock] Error getting git status:", error)
		return null
	}
}
