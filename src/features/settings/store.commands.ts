import { parseCommand } from "@shared/misc/parse-command"

import type { CommandDecision } from "./store.types"

/**
 * Detect dangerous parameter substitutions that could lead to command execution.
 */
export function containsDangerousSubstitution(source: string): boolean {
	const dangerousParameterExpansion = /\$\{[^}]*@[PQEAa][^}]*\}/.test(source)

	const parameterAssignmentWithEscapes =
		/\$\{[^}]*[=+\-?][^}]*\\[0-7]{3}[^}]*\}/.test(source) ||
		/\$\{[^}]*[=+\-?][^}]*\\x[0-9a-fA-F]{2}[^}]*\}/.test(source) ||
		/\$\{[^}]*[=+\-?][^}]*\\u[0-9a-fA-F]{4}[^}]*\}/.test(source)

	const indirectExpansion = /\$\{![^}]+\}/.test(source)

	const hereStringWithSubstitution = /<<<\s*(\$\(|`)/.test(source)

	const zshProcessSubstitution = /(?:(?<=^)|(?<=[\s;|&(<]))=\([^)]+\)/.test(source)

	const zshGlobQualifier = /[*?+@!]\(e:[^:]+:\)/.test(source)

	return (
		dangerousParameterExpansion ||
		parameterAssignmentWithEscapes ||
		indirectExpansion ||
		hereStringWithSubstitution ||
		zshProcessSubstitution ||
		zshGlobQualifier
	)
}

/**
 * Find the longest matching prefix from a list of prefixes for a given command.
 */
export function findLongestPrefixMatch(command: string, prefixes: string[]): string | null {
	if (!command || !prefixes?.length) {
		return null
	}

	const trimmedCommand = command.trim().toLowerCase()
	let longestMatch: string | null = null

	for (const prefix of prefixes) {
		const lowerPrefix = prefix.toLowerCase()
		if (lowerPrefix === "*" || trimmedCommand.startsWith(lowerPrefix)) {
			if (!longestMatch || lowerPrefix.length > longestMatch.length) {
				longestMatch = lowerPrefix
			}
		}
	}

	return longestMatch
}

/**
 * Check if a single command should be auto-approved.
 */
export function isAutoApprovedSingleCommand(
	command: string,
	allowedCommands: string[],
	deniedCommands?: string[],
): boolean {
	if (!command) {
		return true
	}

	if (!allowedCommands?.length) {
		return false
	}

	const hasWildcard = allowedCommands.some((cmd) => cmd.toLowerCase() === "*")

	if (deniedCommands === undefined) {
		const trimmedCommand = command.trim().toLowerCase()

		return allowedCommands.some((prefix) => {
			const lowerPrefix = prefix.toLowerCase()
			return lowerPrefix === "*" || trimmedCommand.startsWith(lowerPrefix)
		})
	}

	const longestDeniedMatch = findLongestPrefixMatch(command, deniedCommands)
	const longestAllowedMatch = findLongestPrefixMatch(command, allowedCommands)

	if (hasWildcard && !longestDeniedMatch) {
		return true
	}

	if (!longestAllowedMatch) {
		return false
	}

	if (!longestDeniedMatch) {
		return true
	}

	return longestAllowedMatch.length > longestDeniedMatch.length
}

/**
 * Check if a single command should be auto-denied.
 */
export function isAutoDeniedSingleCommand(
	command: string,
	allowedCommands: string[],
	deniedCommands?: string[],
): boolean {
	if (!command) return false

	if (!deniedCommands?.length) return false

	const longestDeniedMatch = findLongestPrefixMatch(command, deniedCommands)
	const longestAllowedMatch = findLongestPrefixMatch(command, allowedCommands || [])

	if (!longestDeniedMatch) return false

	if (!longestAllowedMatch) return true

	return longestDeniedMatch.length >= longestAllowedMatch.length
}

/**
 * Unified command validation that implements the longest prefix match rule.
 */
export function getCommandDecision(
	command: string,
	allowedCommands: string[],
	deniedCommands?: string[],
): CommandDecision {
	if (!command?.trim()) {
		return "auto_approve"
	}

	const subCommands = parseCommand(command)

	const decisions: CommandDecision[] = subCommands.map((cmd) => {
		const cmdWithoutRedirection = cmd.replace(/\d*>&\d*/, "").trim()

		return getSingleCommandDecision(cmdWithoutRedirection, allowedCommands, deniedCommands)
	})

	if (decisions.includes("auto_deny")) {
		return "auto_deny"
	}

	if (containsDangerousSubstitution(command)) {
		return "ask_user"
	}

	if (decisions.every((decision) => decision === "auto_approve")) {
		return "auto_approve"
	}

	return "ask_user"
}

/**
 * Get the decision for a single command using longest prefix match rule.
 */
export function getSingleCommandDecision(
	command: string,
	allowedCommands: string[],
	deniedCommands?: string[],
): CommandDecision {
	if (!command) {
		return "auto_approve"
	}

	const longestAllowedMatch = findLongestPrefixMatch(command, allowedCommands)
	const longestDeniedMatch = findLongestPrefixMatch(command, deniedCommands ?? [])

	const allowedLen = longestAllowedMatch?.length ?? 0
	const deniedLen = longestDeniedMatch?.length ?? 0

	if (allowedLen > deniedLen) {
		return "auto_approve"
	}

	if (deniedLen > allowedLen) {
		return "auto_deny"
	}

	if (allowedLen > 0) {
		return "auto_deny"
	}

	return "ask_user"
}
