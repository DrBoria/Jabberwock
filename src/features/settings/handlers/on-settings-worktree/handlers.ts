import vscode from "vscode"
import path from "path"
import * as os from "os"

import type { WorktreeResult, BranchInfo, WorktreeIncludeStatus, WorktreeDefaultsResponse } from "@jabberwock/types"
import { worktreeService, worktreeIncludeService, type CopyProgressCallback } from "@jabberwock/core"

import { getWorkspacePath } from "@utils/io/path"
import { getSettingsAccess } from "@utils/settings"

/**
 * Generate a random alphanumeric suffix for branch/folder names.
 */
export function generateRandomSuffix(length = 5): string {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
	let result = ""

	for (let i = 0; i < length; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length))
	}

	return result
}

export async function isWorkspaceSubfolder(cwd: string): Promise<boolean> {
	const gitRoot = await worktreeService.getGitRootPath(cwd)

	if (!gitRoot) {
		return false
	}

	const normalizedCwd = path.normalize(cwd)
	const normalizedGitRoot = path.normalize(gitRoot)

	return normalizedCwd !== normalizedGitRoot && normalizedCwd.startsWith(normalizedGitRoot)
}

export async function handleCreateWorktreeInternal(
	options: {
		path: string
		branch?: string
		baseBranch?: string
		createNewBranch?: boolean
	},
	onCopyProgress?: CopyProgressCallback,
): Promise<WorktreeResult> {
	const cwd = getWorkspacePath()

	const isGitRepo = await worktreeService.checkGitRepo(cwd)

	if (!isGitRepo) {
		return {
			success: false,
			message: "Not a git repository",
		}
	}

	const result = await worktreeService.createWorktree(cwd, options)

	if (result.success && result.worktree) {
		try {
			const copiedItems = await worktreeIncludeService.copyWorktreeIncludeFiles(
				cwd,
				result.worktree.path,
				onCopyProgress,
			)
			if (copiedItems.length > 0) {
				result.message += ` (copied ${copiedItems.length} item(s) from .worktreeinclude)`
			}
		} catch (error) {
			console.warn("Warning: Failed to copy .worktreeinclude files:", error)
		}
	}

	return result
}

export async function handleDeleteWorktreeInternal(worktreePath: string, force = false): Promise<WorktreeResult> {
	const cwd = getWorkspacePath()
	return worktreeService.deleteWorktree(cwd, worktreePath, force)
}

export async function handleSwitchWorktreeInternal(worktreePath: string, newWindow: boolean): Promise<WorktreeResult> {
	try {
		const worktreeUri = vscode.Uri.file(worktreePath)

		await getSettingsAccess().setValue("worktreeAutoOpenPath", worktreePath)
		await vscode.commands.executeCommand("vscode.openFolder", worktreeUri, { forceNewWindow: newWindow })

		return {
			success: true,
			message: `Opened worktree at ${worktreePath}`,
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		return {
			success: false,
			message: `Failed to switch worktree: ${errorMessage}`,
		}
	}
}

export async function handleGetAvailableBranchesInternal(): Promise<BranchInfo> {
	const cwd = getWorkspacePath()
	return worktreeService.getAvailableBranches(cwd, true)
}

export async function handleGetWorktreeDefaultsInternal(): Promise<WorktreeDefaultsResponse> {
	const suffix = generateRandomSuffix()
	const workspaceFolders = vscode.workspace.workspaceFolders
	const projectName = workspaceFolders?.[0]?.name || "project"

	const dotRooPath = path.join(os.homedir(), ".jabberwock")
	const suggestedPath = path.join(dotRooPath, "worktrees", `${projectName}-${suffix}`)

	return {
		suggestedBranch: `worktree/jabberwock-${suffix}`,
		suggestedPath,
	}
}

export async function handleGetWorktreeIncludeStatusInternal(): Promise<WorktreeIncludeStatus> {
	const cwd = getWorkspacePath()
	return worktreeIncludeService.getStatus(cwd)
}

export async function handleCheckBranchWorktreeIncludeInternal(branch: string): Promise<boolean> {
	const cwd = getWorkspacePath()
	return worktreeIncludeService.branchHasWorktreeInclude(cwd, branch)
}

export async function handleCreateWorktreeIncludeInternal(content: string): Promise<WorktreeResult> {
	const cwd = getWorkspacePath()

	try {
		await worktreeIncludeService.createWorktreeInclude(cwd, content)

		try {
			const filePath = path.join(cwd, ".worktreeinclude")
			const document = await vscode.workspace.openTextDocument(filePath)
			await vscode.window.showTextDocument(document)
		} catch {
			// Opening the file in editor is a convenience feature - don't fail the operation
		}

		return {
			success: true,
			message: ".worktreeinclude file created",
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		return {
			success: false,
			message: `Failed to create .worktreeinclude: ${errorMessage}`,
		}
	}
}

export async function handleCheckoutBranchInternal(branch: string): Promise<WorktreeResult> {
	const cwd = getWorkspacePath()
	return worktreeService.checkoutBranch(cwd, branch)
}
