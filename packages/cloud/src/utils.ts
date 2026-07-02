export function getUserAgent(context?: { extension?: { packageJSON?: Record<string, unknown> } }): string {
	return `Jabberwock ${context?.extension?.packageJSON?.version || "unknown"}`
}
