export function normalizeError(error: unknown): Error {
	return error instanceof Error ? error : new Error(String(error))
}
export function fail(message: string): never {
	console.error(`[CLI] Error: ${message}`)
	process.exit(1)
}
export function failWithUsage(message: string, usage: string): never {
	console.error(`[CLI] Error: ${message}`)
	console.error(`[CLI] Usage: ${usage}`)
	process.exit(1)
}
