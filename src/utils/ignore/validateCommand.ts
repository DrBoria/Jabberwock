/**
 * Check if a terminal command should be allowed based on .jabberwockignore patterns.
 *
 * Pure function — no module-level state.
 */
import { validateAccess } from "./validateAccess"

/**
 * Check if a terminal command attempts to access ignored files.
 * @param patterns - Raw .jabberwockignore content (undefined = no ignore rules)
 * @param command - Terminal command to validate
 * @param cwd - Current working directory
 * @returns Path of file being accessed if it is ignored, undefined if allowed
 */
export function validateCommand(patterns: string | undefined, command: string, cwd: string): string | undefined {
	// Always allow if no .jabberwockignore exists
	if (!patterns) {
		return undefined
	}

	// Split command into parts and get the base command
	const parts = command.trim().split(/\s+/)
	const baseCommand = parts[0].toLowerCase()

	// Commands that read file contents
	const fileReadingCommands = [
		// Unix commands
		"cat",
		"less",
		"more",
		"head",
		"tail",
		"grep",
		"awk",
		"sed",
		// PowerShell commands and aliases
		"get-content",
		"gc",
		"type",
		"select-string",
		"sls",
	]

	if (fileReadingCommands.includes(baseCommand)) {
		// Check each argument that could be a file path
		for (let i = 1; i < parts.length; i++) {
			const arg = parts[i]
			// Skip command flags/options (both Unix and PowerShell style)
			if (arg.startsWith("-") || arg.startsWith("/")) {
				continue
			}
			// Ignore PowerShell parameter names
			if (arg.includes(":")) {
				continue
			}
			// Validate file access
			if (!validateAccess(patterns, arg, cwd)) {
				return arg
			}
		}
	}

	return undefined
}
