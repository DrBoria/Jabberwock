/**
 * Escapes special regex characters in a string so it can be used
 * as a literal match inside a RegExp constructor.
 *
 * @param str - The string to escape
 * @returns The escaped string safe for use in a regular expression
 */
export function escapeRegExp(str: string): string {
	const escaped = str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
	return escaped
}
