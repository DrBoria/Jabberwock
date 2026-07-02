import { spawn } from "child_process"
import * as fs from "fs/promises"
import * as path from "path"

import ignore, { type Ignore } from "ignore"

export interface CopyProgress {
	bytesCopied: number
	itemName: string
}

export type CopyProgressCallback = (progress: CopyProgress) => void

export function getSizeOnDisk(stats: { size: number; blksize?: number }): number {
	if (stats.blksize !== undefined && stats.blksize > 0) {
		return stats.blksize * Math.ceil(stats.size / stats.blksize)
	}
	return stats.size
}

export async function getPathSize(targetPath: string): Promise<number> {
	try {
		const stats = await fs.stat(targetPath)
		if (stats.isFile()) return getSizeOnDisk(stats)
		if (stats.isDirectory()) return await getDirectorySizeRecursive(targetPath)
		return 0
	} catch {
		return 0
	}
}

export async function getDirectorySizeRecursive(dirPath: string): Promise<number> {
	try {
		const entries = await fs.readdir(dirPath, { withFileTypes: true })
		const sizes = await Promise.all(
			entries.map(async (entry) => {
				const entryPath = path.join(dirPath, entry.name)
				try {
					if (entry.isFile()) {
						const stats = await fs.stat(entryPath)
						return getSizeOnDisk(stats)
					}
					if (entry.isDirectory()) {
						return await getDirectorySizeRecursive(entryPath)
					}
					return 0
				} catch {
					return 0
				}
			}),
		)
		return sizes.reduce((sum, size) => sum + size, 0)
	} catch {
		return 0
	}
}

export async function getCurrentDirectorySize(dirPath: string): Promise<number> {
	try {
		await fs.access(dirPath)
		return await getDirectorySizeRecursive(dirPath)
	} catch {
		return 0
	}
}

export async function parseIgnoreFile(filePath: string): Promise<string[]> {
	try {
		const content = await fs.readFile(filePath, "utf-8")
		return content
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line && !line.startsWith("#"))
	} catch {
		return []
	}
}

export async function findMatchingItems(
	sourceDir: string,
	includeMatcher: Ignore,
	gitignoreMatcher: Ignore,
): Promise<string[]> {
	const matchingItems: string[] = []

	try {
		const entries = await fs.readdir(sourceDir, { withFileTypes: true })

		for (const entry of entries) {
			const relativePath = entry.name

			if (relativePath === ".git") continue

			const matchesWorktreeInclude = includeMatcher.ignores(relativePath)
			const matchesGitignore = gitignoreMatcher.ignores(relativePath)

			if (matchesWorktreeInclude && matchesGitignore) {
				matchingItems.push(relativePath)
			}
		}
	} catch {
		return []
	}

	return matchingItems
}

export async function copyDirectoryWithProgress(
	source: string,
	target: string,
	itemName: string,
	bytesCopiedBefore: number,
	onProgress?: CopyProgressCallback,
): Promise<number> {
	await fs.mkdir(path.dirname(target), { recursive: true })

	const isWindows = process.platform === "win32"

	const copyPromise = new Promise<void>((resolve, reject) => {
		let proc: ReturnType<typeof spawn>

		if (isWindows) {
			proc = spawn("robocopy", [source, target, "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/NC", "/NS", "/NP"], {
				windowsHide: true,
			})
		} else {
			proc = spawn("cp", ["-r", "--", source, target])
		}

		proc.on("close", (code) => {
			if (isWindows) {
				if (code !== null && code < 8) {
					resolve()
				} else {
					reject(new Error(`robocopy failed with code ${code}`))
				}
			} else if (code === 0) {
				resolve()
			} else {
				reject(new Error(`cp failed with code ${code}`))
			}
		})

		proc.on("error", reject)
	})

	const pollInterval = 500
	let polling = true

	const pollProgress = async () => {
		while (polling) {
			const currentSize = await getCurrentDirectorySize(target)
			onProgress?.({ bytesCopied: bytesCopiedBefore + currentSize, itemName })
			await new Promise((resolve) => setTimeout(resolve, pollInterval))
		}
	}

	const pollPromise = pollProgress()

	try {
		await copyPromise
	} finally {
		polling = false
		await pollPromise.catch(() => {})
	}

	const finalSize = await getPathSize(target)
	return bytesCopiedBefore + finalSize
}

export async function resolveItemsToCopy(
	sourceDir: string,
	worktreeIncludePath: string,
	gitignorePath: string,
): Promise<string[]> {
	let hasWorktreeInclude = false
	let hasGitignore = false

	try {
		await fs.access(worktreeIncludePath)
		hasWorktreeInclude = true
	} catch {
		hasWorktreeInclude = false
	}

	try {
		await fs.access(gitignorePath)
		hasGitignore = true
	} catch {
		hasGitignore = false
	}

	if (!hasWorktreeInclude || !hasGitignore) {
		return []
	}

	const worktreeIncludePatterns = await parseIgnoreFile(worktreeIncludePath)
	const gitignorePatterns = await parseIgnoreFile(gitignorePath)

	if (worktreeIncludePatterns.length === 0 || gitignorePatterns.length === 0) {
		return []
	}

	const worktreeIncludeMatcher = ignore().add(worktreeIncludePatterns)
	const gitignoreMatcher = ignore().add(gitignorePatterns)

	return findMatchingItems(sourceDir, worktreeIncludeMatcher, gitignoreMatcher)
}

export async function copySingleFile(
	sourcePath: string,
	targetPath: string,
	item: string,
	bytesCopied: number,
	onProgress?: CopyProgressCallback,
): Promise<void> {
	onProgress?.({ bytesCopied, itemName: item })
	await fs.mkdir(path.dirname(targetPath), { recursive: true })
	await fs.copyFile(sourcePath, targetPath)
}
