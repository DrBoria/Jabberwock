/**
 * Shared constants for the Settings feature.
 *
 * Constants that were once scattered across module-level files (protection.ts, ignore.ts)
 * are consolidated here for type-safe imports without module-level side effects.
 */

// ── Protection ────────────────────────────────────────────────────

export const SHIELD_SYMBOL = "\u{1F6E1}"

/**
 * Predefined list of protected Jabberwock configuration patterns.
 * These files always require approval for modifications.
 */
export const PROTECTED_PATTERNS: readonly string[] = [
	".jabberwockignore",
	".jabberwockmodes",
	".jabberwockrules*",
	".clinerules*",
	".jabberwock/**",
	".vscode/**",
	"*.code-workspace",
	".jabberwockprotected", // For future use
	"AGENTS.md",
	"AGENT.md",
] as const

/**
 * Display message for protected file operations.
 */
export const PROTECTION_MESSAGE = "This is a Jabberwock configuration file and requires approval for modifications"

/**
 * Get formatted instructions about protected files for the LLM.
 */
export function getProtectionInstructions(): string {
	const patterns = PROTECTED_PATTERNS.join(", ")
	return [
		"# Protected Files",
		"",
		`(The following Jabberwock configuration file patterns are write-protected and always require approval for modifications, regardless of autoapproval settings. When using list_files, you'll notice a ${SHIELD_SYMBOL} next to files that are write-protected.)`,
		"",
		`Protected patterns: ${patterns}`,
	].join("\n")
}

// ── Ignore Rules ───────────────────────────────────────────────────

export const LOCK_TEXT_SYMBOL = "\u{1F512}"

/**
 * Get formatted instructions about the .jabberwockignore file for the LLM.
 * @returns Formatted instructions or undefined if content is empty
 */
export function getIgnoreInstructions(content: string | undefined): string | undefined {
	if (!content) {
		return undefined
	}

	return [
		"# .jabberwockignore",
		"",
		`(The following is provided by a root-level .jabberwockignore file where the user has specified files and directories that should not be accessed. When using list_files, you'll notice a ${LOCK_TEXT_SYMBOL} next to files that are blocked. Attempting to access the file's contents e.g. through read_file will result in an error.)`,
		"",
		content,
		".jabberwockignore",
	].join("\n")
}
