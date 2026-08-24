/**
 * Check if a file should be accessible based on .jabberwockignore patterns.
 *
 * Pure function — no module-level state.
 * Builds the Ignore instance inline from the patterns string.
 */
import path from "path"
import fsSync from "fs"
import ignore from "ignore"

/**
 * Check if a file path should be accessible.
 * @param patterns - Raw .jabberwockignore content (undefined = no ignore rules)
 * @param filePath - Path to check (relative to cwd)
 * @param cwd - Current working directory
 * @returns true if file is accessible, false if ignored
 */
export function validateAccess(patterns: string | undefined, filePath: string, cwd: string): boolean {
	// Always allow access if .jabberwockignore does not exist
	if (!patterns) {
		return true
	}

	try {
		const absolutePath = path.resolve(cwd, filePath)

		// Follow symlinks to get the real path
		let realPath: string
		try {
			realPath = fsSync.realpathSync(absolutePath)
		} catch {
			// If realpath fails (file doesn't exist, broken symlink, etc.),
			// use the original path
			realPath = absolutePath
		}

		// Convert real path to relative for .jabberwockignore checking
		const relativePath = path.relative(cwd, realPath).toPosix()

		// Build Ignore instance inline from patterns string
		const ignoreInstance = ignore().add(patterns)
		ignoreInstance.add(".jabberwockignore")

		// Check if the real path is ignored
		return !ignoreInstance.ignores(relativePath)
	} catch (_error) {
		// Allow access to files outside cwd or on errors (backward compatibility)
		return true
	}
}
