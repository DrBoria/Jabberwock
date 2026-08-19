import { ProxyConfig } from "./networkProxy.types"

export function redactProxyUrl(proxyUrl: string | undefined): string {
	if (!proxyUrl) {
		return "(not set)"
	}

	try {
		const url = new URL(proxyUrl)
		url.username = ""
		url.password = ""
		return url.toString()
	} catch {
		return proxyUrl.replace(/\/\/[^@/]+@/g, "//REDACTED@")
	}
}

export function normalizeHeadersForUndici(headers?: HeadersInit): Record<string, string> | undefined {
	if (!headers) return undefined
	const h = new Headers(headers)
	const result: Record<string, string> = {}
	h.forEach((value, key) => {
		result[key] = value
	})
	return result
}

export function updateProxyEnvVars(config: ProxyConfig): void {
	if (config.serverUrl) {
		const bypassHosts = [
			"openrouter.ai",
			"*.openrouter.ai",
			"ai-gateway.vercel.sh",
			"*.ai-gateway.vercel.sh",
			"api.getunbound.ai",
			"*.api.getunbound.ai",
		]

		process.env.GLOBAL_AGENT_HTTP_PROXY = config.serverUrl
		process.env.GLOBAL_AGENT_HTTPS_PROXY = config.serverUrl
		process.env.GLOBAL_AGENT_NO_PROXY = bypassHosts.join(",")

		const existingNoProxy = process.env.NO_PROXY || ""
		const noProxyEntries = existingNoProxy ? existingNoProxy.split(",").map((s) => s.trim()) : []
		for (const host of bypassHosts) {
			if (!noProxyEntries.includes(host)) {
				noProxyEntries.push(host)
			}
		}
		process.env.NO_PROXY = noProxyEntries.join(",")
	}
}
