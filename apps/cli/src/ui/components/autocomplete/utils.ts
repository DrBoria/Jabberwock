/**
 * Get the last line from a multi-line string value.
 */
export function getLastLine(value: string): string {
	const lines = value.split("\n")
	return lines[lines.length - 1] || ""
}
