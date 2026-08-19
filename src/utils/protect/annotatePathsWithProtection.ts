/**
 * Annotate an array of paths with their protection status.
 *
 * Pure function — delegates to isWriteProtected.
 */
import { isWriteProtected } from "./isWriteProtected"

/**
 * Filter an array of paths, marking which ones are protected.
 * @param cwd - Current working directory used to resolve paths
 * @param paths - Array of paths to check (relative to cwd)
 * @returns Array of objects with path and protection status
 */
export function annotatePathsWithProtection(
	cwd: string,
	paths: string[],
): Array<{ path: string; isProtected: boolean }> {
	return paths.map((filePath) => ({
		path: filePath,
		isProtected: isWriteProtected(cwd, filePath),
	}))
}
