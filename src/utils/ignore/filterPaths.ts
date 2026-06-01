/**
 * Filter an array of paths, removing those that should be ignored.
 *
 * Pure function — no module-level state.
 */
import { validateAccess } from "./validateAccess"

/**
 * Filter paths, removing those that match .jabberwockignore patterns.
 * @param patterns - Raw .jabberwockignore content (undefined = no filtering)
 * @param paths - Array of paths to filter (relative to cwd)
 * @param cwd - Current working directory
 * @returns Array of allowed paths
 */
export function filterPaths(patterns: string | undefined, paths: string[], cwd: string): string[] {
	try {
		return paths
			.map((p) => ({
				path: p,
				allowed: validateAccess(patterns, p, cwd),
			}))
			.filter((x) => x.allowed)
			.map((x) => x.path)
	} catch (error) {
		console.error("[jabberwock] Error filtering paths:", error)
		return [] // Fail closed for security
	}
}
