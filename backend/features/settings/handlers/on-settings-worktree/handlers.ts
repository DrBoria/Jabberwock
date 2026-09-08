import path from "path"
import * as os from "os"

import type { WorktreeResult, BranchInfo, WorktreeIncludeStatus, WorktreeDefaultsResponse } from "@jabberwock/types"
import { worktreeService, worktreeIncludeService, type CopyProgressCallback } from "@jabberwock/core"

import { getWorkspacePath } from "@utils/io/path"
import { getSettingsAccess } from "@utils/settings"
import { getHostContext, getWorkspaceRoot } from "@features/foundation/host-context/context"

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
		await getSettingsAccess().setValue("worktreeAutoOpenPath", worktreePath)
		// D4g-2 (batch 3): open the worktree folder via the hostCommands slot (D4g-pre) — server
		// mode has no host window, so this degrades to a no-op.
		getHostContext()?.hostCommands?.openFolder?.(worktreePath, { forceNewWindow: newWindow })

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
	// D4g-2 (batch 3): workspace folder name via the host-context slot (D4e) — the folder name is
	// the basename of the first workspace root; server mode has no workspace, so "project".
	const workspaceRoot = getWorkspaceRoot()
	const projectName = workspaceRoot ? path.basename(workspaceRoot) : "project"

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
			// D4g-2 (batch 3): open the file in the host editor via the hostCommands slot (D4g-pre).
			getHostContext()?.hostCommands?.openFileInEditor?.(filePath)
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
