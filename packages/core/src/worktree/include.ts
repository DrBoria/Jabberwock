import { execFile } from "child_process"
import * as fs from "fs/promises"
import * as path from "path"
import { promisify } from "util"

import type { WorktreeIncludeStatus } from "./types.ts"
import {
	copyDirectoryWithProgress,
	copySingleFile,
	getSizeOnDisk,
	resolveItemsToCopy,
	type CopyProgressCallback,
} from "./include-helpers.ts"

const execFileAsync = promisify(execFile)

export class WorktreeIncludeService {
	async hasWorktreeInclude(dir: string): Promise<boolean> {
		try {
			await fs.access(path.join(dir, ".worktreeinclude"))
			return true
		} catch {
			return false
		}
	}

	async branchHasWorktreeInclude(cwd: string, branch: string): Promise<boolean> {
		try {
			await execFileAsync("git", ["cat-file", "-e", "--", `${branch}:.worktreeinclude`], { cwd })
			return true
		} catch {
			return false
		}
	}

	async getStatus(dir: string): Promise<WorktreeIncludeStatus> {
		let exists = false
		let hasGitignore = false
		let gitignoreContent: string | undefined

		try {
			await fs.access(path.join(dir, ".worktreeinclude"))
			exists = true
		} catch {
			exists = false
		}
		try {
			gitignoreContent = await fs.readFile(path.join(dir, ".gitignore"), "utf-8")
			hasGitignore = true
		} catch {
			hasGitignore = false
		}

		return { exists, hasGitignore, gitignoreContent }
	}

	async createWorktreeInclude(dir: string, content: string): Promise<void> {
		await fs.writeFile(path.join(dir, ".worktreeinclude"), content, "utf-8")
	}

	async copyWorktreeIncludeFiles(
		sourceDir: string,
		targetDir: string,
		onProgress?: CopyProgressCallback,
	): Promise<string[]> {
		const itemsToCopy = await resolveItemsToCopy(
			sourceDir,
			path.join(sourceDir, ".worktreeinclude"),
			path.join(sourceDir, ".gitignore"),
		)

		if (itemsToCopy.length === 0) return []

		let bytesCopied = 0

		if (onProgress && itemsToCopy.length > 0) {
			onProgress({ bytesCopied: 0, itemName: itemsToCopy[0]! })
		}

		const copiedItems: string[] = []
		for (const item of itemsToCopy) {
			const sourcePath = path.join(sourceDir, item)
			const targetPath = path.join(targetDir, item)

			try {
				const stats = await fs.stat(sourcePath)

				if (stats.isDirectory()) {
					bytesCopied = await copyDirectoryWithProgress(sourcePath, targetPath, item, bytesCopied, onProgress)
				} else {
					await copySingleFile(sourcePath, targetPath, item, bytesCopied, onProgress)
					bytesCopied += getSizeOnDisk(stats)
				}

				copiedItems.push(item)
				onProgress?.({ bytesCopied, itemName: item })
			} catch (error) {
				console.error(`Failed to copy ${item}:`, error)
			}
		}

		return copiedItems
	}
}

export const worktreeIncludeService = new WorktreeIncludeService()
