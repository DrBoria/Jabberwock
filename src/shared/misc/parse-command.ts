import { parse } from "shell-quote"

export type ShellToken = string | { op: string } | { command: string }

/**
 * Split a command string into individual sub-commands by
 * chaining operators (&&, ||, ;, |, or &) and newlines.
 *
 * Uses shell-quote to properly handle:
 * - Quoted strings (preserves quotes)
 * - Subshell commands ($(cmd), `cmd`, <(cmd), >(cmd))
 * - PowerShell redirections (2>&1)
 * - Chain operators (&&, ||, ;, |, &)
 * - Newlines as command separators
 */
export function parseCommand(command: string): string[] {
	if (!command?.trim()) {
		return []
	}

	// Split by newlines first (handle different line ending formats)
	// This regex splits on \r\n (Windows), \n (Unix), or \r (old Mac)
	const lines = command.split(/\r\n|\r|\n/)
	const allCommands: string[] = []

	for (const line of lines) {
		// Skip empty lines
		if (!line.trim()) {
			continue
		}

		// Process each line through the existing parsing logic
		const lineCommands = parseCommandLine(line)
		allCommands.push(...lineCommands)
	}

	return allCommands
}

interface PlaceholderStore {
	redirections: string[]
	subshells: string[]
	quotes: string[]
	arrayIndexing: string[]
	arithmeticExpressions: string[]
	variables: string[]
	parameterExpansions: string[]
}

function createPlaceholderStore(): PlaceholderStore {
	return {
		redirections: [],
		subshells: [],
		quotes: [],
		arrayIndexing: [],
		arithmeticExpressions: [],
		variables: [],
		parameterExpansions: [],
	}
}

function replacePlaceholders(command: string, store: PlaceholderStore): string {
	const patterns: Array<{
		regex: RegExp
		storeKey: keyof PlaceholderStore
		prefix: string
		trimInner?: boolean
	}> = [
		{ regex: /\d*>&\d*/g, storeKey: "redirections", prefix: "__REDIR_" },
		{ regex: /\$\(\([^)]*(?:\)[^)]*)*\)\)/g, storeKey: "arithmeticExpressions", prefix: "__ARITH_" },
		{ regex: /\$\[[^\]]*\]/g, storeKey: "arithmeticExpressions", prefix: "__ARITH_" },
		{ regex: /\$\{[^}]+\}/g, storeKey: "parameterExpansions", prefix: "__PARAM_" },
		{ regex: /[<>]\(([^)]+)\)/g, storeKey: "subshells", prefix: "__SUBSH_", trimInner: true },
		{ regex: /\$[a-zA-Z_][a-zA-Z0-9_]*/g, storeKey: "variables", prefix: "__VAR_" },
		{ regex: /\$[?!#$@*\-0-9]/g, storeKey: "variables", prefix: "__VAR_" },
	]

	let processed = command
	for (const { regex, storeKey, prefix } of patterns) {
		processed = processed.replace(regex, (match: string) => {
			const arr = store[storeKey] as string[]
			arr.push(match)
			return `${prefix}${arr.length - 1}__`
		})
	}

	// Handle $() and backtick subshells
	processed = processed
		.replace(/\$\((.*?)\)/g, (_, inner: string) => {
			store.subshells.push(inner.trim())
			return `__SUBSH_${store.subshells.length - 1}__`
		})
		.replace(/`(.*?)`/g, (_, inner: string) => {
			store.subshells.push(inner.trim())
			return `__SUBSH_${store.subshells.length - 1}__`
		})

	// Handle quoted strings
	processed = processed.replace(/"[^"]*"/g, (match: string) => {
		store.quotes.push(match)
		return `__QUOTE_${store.quotes.length - 1}__`
	})

	return processed
}

function handleParseFallback(processedCommand: string, store: PlaceholderStore): string[] {
	console.warn("[jabberwock] shell-quote parse error for command:", processedCommand)

	return processedCommand
		.split(/(?:&&|\|\||;|\||&)/)
		.map((cmd) => cmd.trim())
		.filter((cmd) => cmd.length > 0)
		.map((cmd) => restoreAllPlaceholders(cmd, store))
}

function restoreAllPlaceholders(cmd: string, store: PlaceholderStore): string {
	const { redirections, quotes, arrayIndexing, arithmeticExpressions, parameterExpansions, variables, subshells } =
		store
	return restorePlaceholders(
		cmd,
		quotes,
		redirections,
		arrayIndexing,
		arithmeticExpressions,
		parameterExpansions,
		variables,
		subshells,
	)
}

function isChainOperator(op: string): boolean {
	return ["&&", "||", ";", "|", "&"].includes(op)
}

function processOperatorToken(token: { op: string }, currentCommand: string[], commands: string[]): void {
	if (isChainOperator(token.op)) {
		if (currentCommand.length > 0) {
			commands.push(currentCommand.join(" "))
			currentCommand.length = 0
		}
	} else {
		currentCommand.push(token.op)
	}
}

function processStringToken(token: string, currentCommand: string[], commands: string[], subshells: string[]): void {
	const subshellMatch = token.match(/__SUBSH_(\d+)__/)
	if (subshellMatch) {
		if (currentCommand.length > 0) {
			commands.push(currentCommand.join(" "))
			currentCommand.length = 0
		}
		commands.push(subshells[parseInt(subshellMatch[1])])
	} else {
		currentCommand.push(token)
	}
}

/**
 * Parse a single line of commands.
 */
function parseCommandLine(command: string): string[] {
	if (!command?.trim()) return []

	const store = createPlaceholderStore()
	const processedCommand = replacePlaceholders(command, store)

	let tokens: ShellToken[]
	try {
		tokens = parse(processedCommand) as ShellToken[]
	} catch {
		return handleParseFallback(processedCommand, store)
	}

	const commands: string[] = []
	const currentCommand: string[] = []

	for (const token of tokens) {
		if (typeof token === "object" && "op" in token) {
			processOperatorToken(token, currentCommand, commands)
		} else if (typeof token === "string") {
			processStringToken(token, currentCommand, commands, store.subshells)
		}
	}

	if (currentCommand.length > 0) {
		commands.push(currentCommand.join(" "))
	}

	return commands.map((cmd) => restoreAllPlaceholders(cmd, store))
}

/**
 * Helper function to restore placeholders in a command string.
 */
function restorePlaceholders(
	command: string,
	quotes: string[],
	redirections: string[],
	arrayIndexing: string[],
	arithmeticExpressions: string[],
	parameterExpansions: string[],
	variables: string[],
	subshells: string[],
): string {
	let result = command
	// Restore quotes
	result = result.replace(/__QUOTE_(\d+)__/g, (_, i) => quotes[parseInt(i)])
	// Restore redirections
	result = result.replace(/__REDIR_(\d+)__/g, (_, i) => redirections[parseInt(i)])
	// Restore array indexing expressions
	result = result.replace(/__ARRAY_(\d+)__/g, (_, i) => arrayIndexing[parseInt(i)])
	// Restore arithmetic expressions
	result = result.replace(/__ARITH_(\d+)__/g, (_, i) => arithmeticExpressions[parseInt(i)])
	// Restore parameter expansions
	result = result.replace(/__PARAM_(\d+)__/g, (_, i) => parameterExpansions[parseInt(i)])
	// Restore variable references
	result = result.replace(/__VAR_(\d+)__/g, (_, i) => variables[parseInt(i)])
	result = result.replace(/__SUBSH_(\d+)__/g, (_, i) => subshells[parseInt(i)])
	return result
}
