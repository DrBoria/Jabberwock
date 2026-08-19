import { VirtualWorkspace, virtualWorkspace } from "@features/foundation/time-machine/VirtualWorkspace"
import {
	handleSpecialDirectories,
	getFirstLevelDirectories,
	createIgnoreInstance,
	ensureFirstLevelDirectoriesIncluded,
	formatAndCombineResults,
} from "./list-files-utils"
import { listFilteredDirectories } from "./list-files-scanner"
import { getRipgrepPath, listFilesWithRipgrep } from "./list-files-ripgrep"

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

	// Get ripgrep path
	const rgPath = await getRipgrepPath()

	if (!recursive) {
		// For non-recursive, use the existing approach
		const files = await listFilesWithRipgrep(rgPath, dirPath, false, limit)
		const ignoreInstance = await createIgnoreInstance(vfs, dirPath)
		// Calculate remaining limit for directories
		const remainingLimit = Math.max(0, limit - files.length)
		const directories = await listFilteredDirectories(vfs, dirPath, false, ignoreInstance, remainingLimit)
		return formatAndCombineResults(files, directories, limit)
	}

	// For recursive mode, use the original approach but ensure first-level directories are included
	const files = await listFilesWithRipgrep(rgPath, dirPath, true, limit)
	const ignoreInstance = await createIgnoreInstance(vfs, dirPath)
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
