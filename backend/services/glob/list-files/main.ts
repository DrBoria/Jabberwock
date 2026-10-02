import * as path from "path"
import ignore from "ignore"
import { VirtualWorkspace, virtualWorkspace } from "@features/foundation/time-machine"
import {
	handleSpecialDirectories,
	getFirstLevelDirectories,
	createIgnoreInstance,
	ensureFirstLevelDirectoriesIncluded,
	formatAndCombineResults,
} from "./utils"
import { listFilteredDirectories } from "./scanner"
import { getRipgrepPath, listFilesWithRipgrep } from "./ripgrep"
import { shouldIncludeDirectory, isIgnoredByGitignore } from "./filter"
import type { ScanContext } from "./filter"

/**
 * List files in a directory, with optional recursive traversal
 *
 * @param dirPath - Directory path to list files from
 * @param recursive - Whether to recursively list files in subdirectories
 * @param limit - Maximum number of files to return
 * @param vfs - VirtualWorkspace instance (optional, defaults to global)
 * @returns Tuple of [file paths array, whether the limit was reached]
 */
export async function listFiles(
	dirPath: string,
	recursive: boolean,
	limit: number = 1000,
	vfs: VirtualWorkspace = virtualWorkspace,
): Promise<[string[], boolean]> {
	// Early return for limit of 0 - no need to scan anything
	if (limit === 0) {
		return [[], false]
	}

	// Handle special directories
	const specialResult = await handleSpecialDirectories(dirPath)

	if (specialResult) {
		return specialResult
	}

	// Get ripgrep path; degrade to a pure-FS scan when no binary is available
	// (missing `rg` must never kill the whole task).
	const rgPath = await getRipgrepPath()
	const ignoreInstance = await createIgnoreInstance(vfs, dirPath)
	const files = rgPath
		? await listFilesWithRipgrep(rgPath, dirPath, recursive, limit)
		: await listFilesWithoutRipgrep(vfs, dirPath, recursive, limit, ignoreInstance)

	if (!recursive) {
		// For non-recursive, use the existing approach
		// Calculate remaining limit for directories
		const remainingLimit = Math.max(0, limit - files.length)
		const directories = await listFilteredDirectories(vfs, dirPath, false, ignoreInstance, remainingLimit)
		return formatAndCombineResults(files, directories, limit)
	}

	// For recursive mode, use the original approach but ensure first-level directories are included
	// Calculate remaining limit for directories
	const remainingLimit = Math.max(0, limit - files.length)
	const directories = await listFilteredDirectories(vfs, dirPath, true, ignoreInstance, remainingLimit)

	// Combine and check if we hit the limits
	const [results, limitReached] = formatAndCombineResults(files, directories, limit)

	// If we hit the limit, ensure all first-level directories are included
	if (limitReached) {
		const firstLevelDirs = await getFirstLevelDirectories(vfs, dirPath, ignoreInstance)
		return ensureFirstLevelDirectoriesIncluded(results, firstLevelDirs, limit)
	}

	return [results, limitReached]
}

/**
 * Fallback file listing when no ripgrep binary is available — walks the
 * filesystem directly with the same ignore rules as the ripgrep path.
 * Mirrors `buildRecursiveArgs`/`buildNonRecursiveArgs` semantics: hidden
 * directories are skipped (unless the target itself is hidden) and
 * `DIRS_TO_IGNORE` entries are excluded.
 */
async function listFilesWithoutRipgrep(
	vfs: VirtualWorkspace,
	dirPath: string,
	recursive: boolean,
	limit: number,
	ignoreInstance: ReturnType<typeof ignore>,
): Promise<string[]> {
	const files: string[] = []
	const absolutePath = path.resolve(dirPath)
	const isTargetHidden = path.basename(absolutePath).startsWith(".")

	const isHiddenDirSkipped = (name: string, targetHidden: boolean): boolean => name.startsWith(".") && !targetHidden

	const context: ScanContext = {
		isTargetDir: false,
		insideExplicitHiddenTarget: false,
		basePath: dirPath,
		ignoreInstance,
	}

	// Returns true when the directory should be recursed into.
	const visitDirectory = async (name: string, fullDirPath: string): Promise<boolean> => {
		if (!shouldIncludeDirectory(name, fullDirPath, context)) return false
		if (!recursive || isHiddenDirSkipped(name, isTargetHidden)) return false
		return scan(fullDirPath)
	}

	const visitFile = (name: string, fullPath: string): void => {
		if (isHiddenDirSkipped(name, isTargetHidden)) return
		if (isIgnoredByGitignore(fullPath, dirPath, ignoreInstance)) return
		files.push(fullPath)
	}

	const scan = async (currentPath: string): Promise<boolean> => {
		if (files.length >= limit) return true
		let entries
		try {
			entries = await vfs.readdir(currentPath, { withFileTypes: true })
		} catch (err) {
			console.warn(`[jabberwock] ripgrep fallback: cannot read ${currentPath}: ${err}`)
			return false
		}
		for (const entry of entries) {
			if (files.length >= limit) return true
			if (entry.isSymbolicLink()) continue
			const fullDirPath = path.join(currentPath, entry.name)
			if (entry.isDirectory()) {
				if (await visitDirectory(entry.name, fullDirPath)) return true
			} else if (entry.isFile()) {
				visitFile(entry.name, fullDirPath)
			}
		}
		return false
	}

	await scan(absolutePath)
	if (files.length > 0) {
		console.warn(
			`[jabberwock] ripgrep binary not found — file listing degraded to a plain filesystem scan (${files.length} files)`,
		)
	}
	return files
}
