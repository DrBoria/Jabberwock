import type { WorktreeListResponse } from "@jabberwock/types"
import { worktreeService } from "@jabberwock/core"

// v4 B2 (L4): workspace roots come from the host context DI slot, not vscode directly.
import { getWorkspaceRoots } from "@features/foundation/vscode/context"
import { getWorkspacePath } from "@utils/io/path"
import { isWorkspaceSubfolder } from "./handlers"

export async function handleListWorktrees(): Promise<WorktreeListResponse> {
	const workspaceRoots = getWorkspaceRoots()
	const isMultiRoot = workspaceRoots.length > 1

	if (workspaceRoots.length === 0) {
		return {
			worktrees: [],
			isGitRepo: false,
			isMultiRoot: false,
			isSubfolder: false,
			gitRootPath: "",
			error: "No workspace folder open",
		}
	}

	if (isMultiRoot) {
		return {
			worktrees: [],
			isGitRepo: false,
			isMultiRoot: true,
			isSubfolder: false,
			gitRootPath: "",
			error: "Worktrees are not supported in multi-root workspaces",
		}
	}

	const cwd = getWorkspacePath()
	const isGitRepo = await worktreeService.checkGitRepo(cwd)

	if (!isGitRepo) {
		return {
			worktrees: [],
			isGitRepo: false,
			isMultiRoot: false,
			isSubfolder: false,
			gitRootPath: "",
			error: "Not a git repository",
		}
	}

	const isSubfolder = await isWorkspaceSubfolder(cwd)
	const gitRootPath = (await worktreeService.getGitRootPath(cwd)) || ""

	if (isSubfolder) {
		return {
			worktrees: [],
			isGitRepo: true,
			isMultiRoot: false,
			isSubfolder: true,
			gitRootPath,
			error: "Worktrees are not supported when workspace is a subfolder of a git repository",
		}
	}

	try {
		const worktrees = await worktreeService.listWorktrees(cwd)

		return {
			worktrees,
			isGitRepo: true,
			isMultiRoot: false,
			isSubfolder: false,
			gitRootPath,
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)

		return {
			worktrees: [],
			isGitRepo: true,
			isMultiRoot: false,
			isSubfolder: false,
			gitRootPath,
			error: `Failed to list worktrees: ${errorMessage}`,
		}
	}
}
