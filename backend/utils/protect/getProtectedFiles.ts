/**
 * Get a Set of write-protected files from a list of paths.
 *
 * Pure function — delegates to isWriteProtected.
 */
import { isWriteProtected } from "./isWriteProtected"

/**
 * Get set of write-protected files from a list.
 * @param cwd - Current working directory used to resolve paths
 * @param paths - Array of paths to check (relative to cwd)
 * @returns Set of protected file paths
 */
export function getProtectedFiles(cwd: string, paths: string[]): Set<string> {
	const protectedFiles = new Set<string>()

	for (const filePath of paths) {
		if (isWriteProtected(cwd, filePath)) {
			protectedFiles.add(filePath)
		}
	}

	return protectedFiles
}
