import * as path from "path"
import os from "os"
import ignore from "ignore"
import { VirtualWorkspace } from "@features/foundation/time-machine/VirtualWorkspace"
import { arePathsEqual } from "@utils/io/path"
import type { ScanContext } from "./list-files-filter"
import { shouldIncludeDirectory } from "./list-files-filter"

/**
 * Handle special directories (root, home) that should not be fully listed
 */
export async function handleSpecialDirectories(dirPath: string): Promise<[string[], boolean] | null> {
	const absolutePath = path.resolve(dirPath)

	const root = process.platform === "win32" ? path.parse(absolutePath).root : "/"
	const isRoot = arePathsEqual(absolutePath, root)
	if (isRoot) {
		return [[root], false]
	}

	const homeDir = os.homedir()
	const isHomeDir = arePathsEqual(absolutePath, homeDir)
	if (isHomeDir) {
		return [[homeDir], false]
	}

	return null
}

/**
 * Find all .gitignore files from the given directory up to the workspace root
 */
export async function findGitignoreFiles(vfs: VirtualWorkspace, startPath: string): Promise<string[]> {
	const gitignoreFiles: string[] = []
	let currentPath = startPath

	while (currentPath && currentPath !== path.dirname(currentPath)) {
		const gitignorePath = path.join(currentPath, ".gitignore")

		try {
			await vfs.access(gitignorePath)
			gitignoreFiles.push(gitignorePath)
		} catch {
			// .gitignore doesn't exist at this level, continue
		}

		const parentPath = path.dirname(currentPath)
		if (parentPath === currentPath) {
			break
		}
		currentPath = parentPath
	}

	return gitignoreFiles.reverse()
}

/**
 * Create an ignore instance that handles .gitignore files properly
 */
export async function createIgnoreInstance(vfs: VirtualWorkspace, dirPath: string): Promise<ReturnType<typeof ignore>> {
	const ignoreInstance = ignore()
	const absolutePath = path.resolve(dirPath)

	const gitignoreFiles = await findGitignoreFiles(vfs, absolutePath)

	for (const gitignoreFile of gitignoreFiles) {
		try {
			const content = await vfs.readFile(gitignoreFile)
			ignoreInstance.add(content)
		} catch (err) {
			console.warn(`[jabberwock] Could not read .gitignore at ${gitignoreFile}: ${err}`)
		}
	}

	ignoreInstance.add(".gitignore")

	return ignoreInstance
}

/**
 * Get only the first-level directories in a path
 */
export async function getFirstLevelDirectories(
	vfs: VirtualWorkspace,
	dirPath: string,
	ignoreInstance: ReturnType<typeof ignore>,
): Promise<string[]> {
	const absolutePath = path.resolve(dirPath)
	const directories: string[] = []

	try {
		const entries = await vfs.readdir(absolutePath, { withFileTypes: true })

		for (const entry of entries) {
			if (entry.isDirectory() && !entry.isSymbolicLink()) {
				const fullDirPath = path.join(absolutePath, entry.name)

				const context: ScanContext = {
					isTargetDir: false,
					insideExplicitHiddenTarget: false,
					basePath: dirPath,
					ignoreInstance,
				}
				if (shouldIncludeDirectory(entry.name, fullDirPath, context)) {
					const formattedPath = fullDirPath.endsWith("/") ? fullDirPath : `${fullDirPath}/`
					directories.push(formattedPath)
				}
			}
		}
	} catch (err) {
		console.warn(`[jabberwock] Could not read directory ${absolutePath}: ${err}`)
	}

	return directories
}

/**
 * Ensure all first-level directories are included in the results
 */
export function ensureFirstLevelDirectoriesIncluded(
	results: string[],
	firstLevelDirs: string[],
	limit: number,
): [string[], boolean] {
	const existingPaths = new Set(results)

	const missingDirs = firstLevelDirs.filter((dir) => !existingPaths.has(dir))

	if (missingDirs.length === 0) {
		return [results, true]
	}

	const itemsToRemove = Math.min(missingDirs.length, results.length)
	const adjustedResults = results.slice(0, results.length - itemsToRemove)

	const resultPaths = adjustedResults.map((r) => path.resolve(r))
	const basePath = path.resolve(firstLevelDirs[0]).split(path.sep).slice(0, -1).join(path.sep)

	const firstLevelResults: string[] = []
	const otherResults: string[] = []

	for (let i = 0; i < adjustedResults.length; i++) {
		const resolvedPath = resultPaths[i]
		const relativePath = path.relative(basePath, resolvedPath)
		const depth = relativePath.split(path.sep).length

		if (depth === 1) {
			firstLevelResults.push(adjustedResults[i])
		} else {
			otherResults.push(adjustedResults[i])
		}
	}

	const finalResults = [...firstLevelResults, ...missingDirs, ...otherResults].slice(0, limit)

	return [finalResults, true]
}

/**
 * Combine file and directory results and format them properly
 */
export function formatAndCombineResults(files: string[], directories: string[], limit: number): [string[], boolean] {
	const allPaths = [...directories, ...files]

	const uniquePathsSet = new Set(allPaths)
	const uniquePaths = Array.from(uniquePathsSet)

	uniquePaths.sort((a: string, b: string) => {
		const aIsDir = a.endsWith("/")
		const bIsDir = b.endsWith("/")

		if (aIsDir && !bIsDir) return -1
		if (!aIsDir && bIsDir) return 1
		return a.localeCompare(b)
	})

	const trimmedPaths = uniquePaths.slice(0, limit)
	return [trimmedPaths, trimmedPaths.length >= limit]
}
