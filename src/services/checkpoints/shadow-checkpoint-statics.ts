import * as path from "path"
import crypto from "crypto"
import pWaitFor from "p-wait-for"
import { SimpleGit } from "simple-git"

import { createSanitizedGit } from "./shadow-checkpoint-git"

function workspaceRepoDir({ globalStorageDir, workspaceDir }: { globalStorageDir: string; workspaceDir: string }) {
	const hash = crypto.createHash("sha256").update(workspaceDir).digest("hex").slice(0, 8)
	return path.join(globalStorageDir, "checkpoints", hash)
}

export async function deleteTask({
	taskId,
	globalStorageDir,
	workspaceDir,
}: {
	taskId: string
	globalStorageDir: string
	workspaceDir: string
}) {
	const repoDir = workspaceRepoDir({ globalStorageDir, workspaceDir })
	const branchName = `jabberwock-${taskId}`
	const git = createSanitizedGit(repoDir)
	const success = await deleteBranch(git, branchName)
	if (success) {
		console.log(`[deleteTask.${taskId}] deleted branch ${branchName}`)
	} else {
		console.error(`[jabberwock] [deleteTask.${taskId}] failed to delete branch ${branchName}`)
	}
}

export async function deleteBranch(git: SimpleGit, branchName: string) {
	const branches = await git.branchLocal()
	if (!branches.all.includes(branchName)) {
		console.error(`[deleteBranch] branch ${branchName} does not exist`)
		return false
	}
	const currentBranch = await git.revparse(["--abbrev-ref", "HEAD"])
	if (currentBranch === branchName) {
		const worktree = await git.getConfig("core.worktree")
		try {
			await git.raw(["config", "--unset", "core.worktree"])
			await git.reset(["--hard"])
			await git.clean("f", ["-d"])
			const defaultBranch = branches.all.includes("main") ? "main" : "master"
			await git.checkout([defaultBranch, "--force"])
			await pWaitFor(
				async () => {
					const newBranch = await git.revparse(["--abbrev-ref", "HEAD"])
					return newBranch === defaultBranch
				},
				{ interval: 500, timeout: 2_000 },
			)
			await git.branch(["-D", branchName])
			return true
		} catch (error) {
			console.error(
				`[deleteBranch] failed to delete branch ${branchName}: ${error instanceof Error ? error.message : String(error)}`,
			)
			return false
		} finally {
			if (worktree.value) {
				await git.addConfig("core.worktree", worktree.value)
			}
		}
	}
	await git.branch(["-D", branchName])
	return true
}
