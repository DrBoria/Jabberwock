/**
 * Check if a file path matches any of the protected patterns.
 *
 * Pure function — no side effects, no module-level state.
 * Builds the Ignore instance inline from the patterns constant.
 */
import path from "path"
import ignore from "ignore"
import { PROTECTED_PATTERNS } from "@features/settings/constants"

/**
 * Check if a file is write-protected based on predefined patterns.
 * @param cwd - Current working directory used to resolve paths
 * @param filePath - Path to check (relative to cwd)
 * @returns true if file is write-protected, false otherwise
 */
export function isWriteProtected(cwd: string, filePath: string): boolean {
	try {
		// Normalize path to be relative to cwd and use forward slashes
		const absolutePath = path.resolve(cwd, filePath)
		const relativePath = path.relative(cwd, absolutePath).toPosix()

		// Paths outside the cwd start with ".." and can't match any protected pattern.
		// The ignore library throws RangeError for such paths, so skip them early.
		if (relativePath.startsWith("..")) {
			return false
		}

		// Build Ignore instance inline from the patterns constant
		// This is cheap — the patterns are small and static
		const protectedIgnoreInstance = ignore().add([...PROTECTED_PATTERNS])

		// Use ignore library to check if file matches any protected pattern
		return protectedIgnoreInstance.ignores(relativePath)
	} catch (error) {
		// If there's an error processing the path, err on the side of caution
		console.error(`[jabberwock] Error checking protection for ${filePath}:`, error)
		return false
	}
}
