import fs from "fs/promises"
import path from "path"
import { Dirent } from "fs"

/**
 * Safely read a file and return its trimmed content
 */
export async function safeReadFile(filePath: string): Promise<string> {
	try {
		const content = await fs.readFile(filePath, "utf-8")
		return content.trim()
	} catch (err) {
		const errorCode = (err as NodeJS.ErrnoException).code
		if (!errorCode || !["ENOENT", "EISDIR"].includes(errorCode)) {
			throw err
		}
		return ""
	}
}

/**
 * Check if a directory exists
 */
export async function directoryExists(dirPath: string): Promise<boolean> {
	try {
		const stats = await fs.stat(dirPath)
		return stats.isDirectory()
	} catch (err) {
		return false
	}
}

const MAX_DEPTH = 5

/**
 * Recursively resolve directory entries and collect file paths
 */
async function resolveDirectoryEntry(
	entry: Dirent,
	dirPath: string,
	fileInfo: Array<{ originalPath: string; resolvedPath: string }>,
	depth: number,
): Promise<void> {
	if (depth > MAX_DEPTH) {
		return
	}

	const fullPath = path.resolve(entry.parentPath || dirPath, entry.name)
	if (entry.isFile()) {
		fileInfo.push({ originalPath: fullPath, resolvedPath: fullPath })
	} else if (entry.isSymbolicLink()) {
		await resolveSymLink(fullPath, fileInfo, depth + 1)
	}
}

/**
 * Recursively resolve a symbolic link and collect file paths
 */
export async function resolveSymLink(
	symlinkPath: string,
	fileInfo: Array<{ originalPath: string; resolvedPath: string }>,
	depth: number,
): Promise<void> {
	if (depth > MAX_DEPTH) {
		return
	}
	try {
		const linkTarget = await fs.readlink(symlinkPath)
		const resolvedTarget = path.resolve(path.dirname(symlinkPath), linkTarget)

		const stats = await fs.stat(resolvedTarget)
		if (stats.isFile()) {
			fileInfo.push({
				originalPath: symlinkPath,
				resolvedPath: resolvedTarget,
			})
		} else if (stats.isDirectory()) {
			const anotherEntries = await fs.readdir(resolvedTarget, {
				withFileTypes: true,
				recursive: true,
			})
			const directoryPromises: Promise<void>[] = []
			for (const anotherEntry of anotherEntries) {
				directoryPromises.push(resolveDirectoryEntry(anotherEntry, resolvedTarget, fileInfo, depth + 1))
			}
			await Promise.all(directoryPromises)
		} else if (stats.isSymbolicLink()) {
			await resolveSymLink(resolvedTarget, fileInfo, depth + 1)
		}
	} catch (err) {
		// Skip invalid symlinks
	}
}

/**
 * Read all text files from a directory in alphabetical order
 */
export async function readTextFilesFromDirectory(
	dirPath: string,
): Promise<Array<{ filename: string; content: string }>> {
	try {
		const entries = await fs.readdir(dirPath, {
			withFileTypes: true,
			recursive: true,
		})

		const fileInfo: Array<{ originalPath: string; resolvedPath: string }> = []
		const initialPromises: Promise<void>[] = []

		for (const entry of entries) {
			initialPromises.push(resolveDirectoryEntry(entry, dirPath, fileInfo, 0))
		}

		await Promise.all(initialPromises)

		const fileContents = await Promise.all(
			fileInfo.map(async ({ originalPath, resolvedPath }) => {
				try {
					const stats = await fs.stat(resolvedPath)
					if (stats.isFile()) {
						if (!shouldIncludeRuleFile(resolvedPath)) {
							return null
						}
						const content = await safeReadFile(resolvedPath)
						return { filename: resolvedPath, content, sortKey: originalPath }
					}
					return null
				} catch (err) {
					return null
				}
			}),
		)

		const filteredFiles = fileContents.filter(
			(item): item is { filename: string; content: string; sortKey: string } => item !== null,
		)

		return filteredFiles
			.sort((a, b) => {
				const filenameA = path.basename(a.sortKey).toLowerCase()
				const filenameB = path.basename(b.sortKey).toLowerCase()
				return filenameA.localeCompare(filenameB)
			})
			.map(({ filename, content }) => ({ filename, content }))
	} catch (err) {
		return []
	}
}

/**
 * Format content from multiple files with filenames as headers
 */
export function formatDirectoryContent(files: Array<{ filename: string; content: string }>, cwd: string): string {
	if (files.length === 0) return ""

	return files
		.map((file) => {
			const displayPath = path.relative(cwd, file.filename)
			return `# Rules from ${displayPath}:\n${file.content}`
		})
		.join("\n\n")
}

/**
 * Check if a file should be included in rule compilation.
 * Excludes cache files and system files that shouldn't be processed as rules.
 */
function shouldIncludeRuleFile(filename: string): boolean {
	const basename = path.basename(filename)

	const cachePatterns = [
		"*.DS_Store",
		"*.bak",
		"*.cache",
		"*.crdownload",
		"*.db",
		"*.dmp",
		"*.dump",
		"*.eslintcache",
		"*.lock",
		"*.log",
		"*.old",
		"*.part",
		"*.partial",
		"*.pyc",
		"*.pyo",
		"*.stackdump",
		"*.swo",
		"*.swp",
		"*.temp",
		"*.tmp",
		"Thumbs.db",
	]

	return !cachePatterns.some((pattern) => {
		if (pattern.startsWith("*.")) {
			const extension = pattern.slice(1)
			return basename.endsWith(extension)
		} else {
			return basename === pattern
		}
	})
}
