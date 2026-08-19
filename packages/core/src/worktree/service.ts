import { exec, execFile } from "child_process"
import * as path from "path"
import { promisify } from "util"

import type { BranchInfo, CreateWorktreeOptions, Worktree, WorktreeResult } from "./types.ts"

const execAsync = promisify(exec)
const execFileAsync = promisify(execFile)

export class WorktreeService {
	async checkGitInstalled(): Promise<boolean> {
		try {
			await execAsync("git --version")
			return true
		} catch {
			return false
		}
	}

	async checkGitRepo(cwd: string): Promise<boolean> {
		try {
			await execAsync("git rev-parse --git-dir", { cwd })
			return true
		} catch {
			return false
		}
	}

	async getGitRootPath(cwd: string): Promise<string | null> {
		try {
			const { stdout } = await execAsync("git rev-parse --show-toplevel", { cwd })
			return stdout.trim()
		} catch {
			return null
		}
	}

	async getCurrentWorktreePath(cwd: string): Promise<string | null> {
		try {
			const { stdout } = await execAsync("git rev-parse --show-toplevel", { cwd })
			return stdout.trim()
		} catch {
			return null
		}
	}

	async getCurrentBranch(cwd: string): Promise<string | null> {
		try {
			const { stdout } = await execAsync("git rev-parse --abbrev-ref HEAD", { cwd })
			const branch = stdout.trim()
			return branch === "HEAD" ? null : branch
		} catch {
			return null
		}
	}

	async listWorktrees(cwd: string): Promise<Worktree[]> {
		try {
			const { stdout } = await execAsync("git worktree list --porcelain", { cwd })
			return this.parseWorktreeOutput(stdout, cwd)
		} catch {
			return []
		}
	}

	async createWorktree(cwd: string, options: CreateWorktreeOptions): Promise<WorktreeResult> {
		try {
			const { path: worktreePath, branch, baseBranch, createNewBranch } = options
			const args: string[] = ["worktree", "add"]

			if (createNewBranch && branch) {
				args.push("-b", branch, worktreePath)
				if (baseBranch) args.push(baseBranch)
			} else if (branch) {
				args.push(worktreePath, branch)
			} else {
				args.push("--detach", worktreePath)
			}

			await execFileAsync("git", args, { cwd })

			const worktrees = await this.listWorktrees(cwd)
			const createdWorktree = worktrees.find(
				(wt) => this.normalizePath(wt.path) === this.normalizePath(worktreePath),
			)

			return { success: true, message: `Worktree created at ${worktreePath}`, worktree: createdWorktree }
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			return { success: false, message: `Failed to create worktree: ${errorMessage}` }
		}
	}

	async deleteWorktree(cwd: string, worktreePath: string, force = false): Promise<WorktreeResult> {
		try {
			const worktrees = await this.listWorktrees(cwd)
			const worktreeToDelete = worktrees.find(
				(wt) => this.normalizePath(wt.path) === this.normalizePath(worktreePath),
			)

			const args = ["worktree", "remove"]
			if (force) args.push("--force")
			args.push(worktreePath)
			await execFileAsync("git", args, { cwd })

			if (worktreeToDelete?.branch) {
				try {
					await execFileAsync("git", ["branch", "-d", worktreeToDelete.branch], { cwd })
				} catch {
					/* best-effort */
				}
			}

			return { success: true, message: `Worktree removed from ${worktreePath}` }
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			return { success: false, message: `Failed to delete worktree: ${errorMessage}` }
		}
	}

	async getAvailableBranches(cwd: string, includeWorktreeBranches = false): Promise<BranchInfo> {
		try {
			const [worktrees, localResult, remoteResult, currentBranch] = await Promise.all([
				this.listWorktrees(cwd),
				execAsync('git branch --format="%(refname:short)"', { cwd }),
				execAsync('git branch -r --format="%(refname:short)"', { cwd }),
				this.getCurrentBranch(cwd),
			])

			const branchesInWorktrees = new Set(worktrees.map((wt) => wt.branch).filter(Boolean))

			const localBranches = localResult.stdout
				.trim()
				.split("\n")
				.filter((b) => b && (includeWorktreeBranches || !branchesInWorktrees.has(b)))
			const remoteBranches = remoteResult.stdout
				.trim()
				.split("\n")
				.filter(
					(b) =>
						b &&
						!b.includes("HEAD") &&
						(includeWorktreeBranches || !branchesInWorktrees.has(b.replace(/^origin\//, ""))),
				)

			return { localBranches, remoteBranches, currentBranch: currentBranch || "" }
		} catch {
			return { localBranches: [], remoteBranches: [], currentBranch: "" }
		}
	}

	async checkoutBranch(cwd: string, branch: string): Promise<WorktreeResult> {
		try {
			await execFileAsync("git", ["checkout", branch], { cwd })
			return { success: true, message: `Checked out branch ${branch}` }
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			return { success: false, message: `Failed to checkout branch: ${errorMessage}` }
		}
	}

	private parseWorktreeOutput(output: string, currentCwd: string): Worktree[] {
		const worktrees: Worktree[] = []
		const entries = output.trim().split("\n\n")

		for (const entry of entries) {
			if (!entry.trim()) continue

			const lines = entry.trim().split("\n")
			const worktree: Partial<Worktree> = {
				path: "",
				branch: "",
				commitHash: "",
				isCurrent: false,
				isBare: false,
				isDetached: false,
				isLocked: false,
			}

			for (const line of lines) this.parseWorktreeLine(line, worktree)

			if (worktree.path) {
				worktree.isCurrent = this.normalizePath(worktree.path) === this.normalizePath(currentCwd)
				worktrees.push(worktree as Worktree)
			}
		}

		return worktrees
	}

	private parseWorktreeLine(line: string, worktree: Partial<Worktree>): void {
		if (line.startsWith("worktree ")) worktree.path = line.substring(9).trim()
		else if (line.startsWith("HEAD ")) worktree.commitHash = line.substring(5).trim()
		else if (line.startsWith("branch "))
			worktree.branch = line
				.substring(7)
				.trim()
				.replace(/^refs\/heads\//, "")
		else if (line === "bare") worktree.isBare = true
		else if (line === "detached") worktree.isDetached = true
		else if (line === "locked") worktree.isLocked = true
		else if (line.startsWith("locked ")) {
			worktree.isLocked = true
			worktree.lockReason = line.substring(7).trim()
		}
	}

	private normalizePath(p: string): string {
		let normalized = path.normalize(p)
		if (normalized.length > 1 && (normalized.endsWith("/") || normalized.endsWith("\\"))) {
			normalized = normalized.slice(0, -1)
		}
		return normalized
	}
}

export const worktreeService = new WorktreeService()
