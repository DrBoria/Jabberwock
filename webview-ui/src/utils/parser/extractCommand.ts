import { parse } from "shell-quote"

/**
 * Extract command patterns from a command string.
 * Returns at most 3 levels: base command, command + first argument, and command + first two arguments.
 * Stops at flags (-), paths (/\~), file extensions (.ext), or special characters (:).
 */
function isCommandSeparator(token: unknown): boolean {
	const separators = new Set(["|", "&&", "||", ";"])
	return typeof token === "object" && token !== null && "op" in token && separators.has((token as { op: string }).op)
}

function hasCommandContent(tokens: string[]): boolean {
	return tokens.length > 0
}

export function extractPatternsFromCommand(command: string): string[] {
	if (!command?.trim()) return []

	const patterns = new Set<string>()

	try {
		const parsed = parse(command)
		let currentTokens: string[] = []

		for (const token of parsed) {
			if (isCommandSeparator(token)) {
				if (hasCommandContent(currentTokens)) {
					extractFromTokens(currentTokens, patterns)
					currentTokens = []
				}
			} else if (typeof token === "string") {
				currentTokens.push(token)
			}
		}

		if (hasCommandContent(currentTokens)) {
			extractFromTokens(currentTokens, patterns)
		}
	} catch (error) {
		console.warn("[jabberwock] Failed to parse command:", error)
		const firstWord = command.trim().split(/\s+/)[0]
		if (firstWord) patterns.add(firstWord)
	}

	return Array.from(patterns).sort()
}

function extractFromTokens(tokens: string[], patterns: Set<string>): void {
	if (tokens.length === 0 || typeof tokens[0] !== "string") return

	const mainCmd = tokens[0]

	// Skip numeric commands like "0" from "0 total"
	if (/^\d+$/.test(mainCmd)) return

	patterns.add(mainCmd)

	// Breaking expressions that indicate we should stop looking for subcommands
	const breakingExps = [/^-/, /[\\/:.~ ]/]

	// Extract up to 3 levels maximum
	const maxLevels = Math.min(tokens.length, 3)

	for (let i = 1; i < maxLevels; i++) {
		const arg = tokens[i]

		if (typeof arg !== "string" || breakingExps.some((re) => re.test(arg))) break

		const pattern = tokens.slice(0, i + 1).join(" ")
		patterns.add(pattern.trim())
	}
}
