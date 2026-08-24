import { QdrantClient } from "@qdrant/js-client-rest"

function parseQdrantHostname(hostname: string): string {
	if (hostname.includes(":")) {
		return hostname.startsWith("http") ? hostname : `http://${hostname}`
	}
	return `http://${hostname}`
}

export function parseQdrantUrl(url: string | undefined): string {
	if (!url || url.trim() === "") {
		return "http://localhost:6333"
	}

	const trimmedUrl = url.trim()

	if (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://") && !trimmedUrl.includes("://")) {
		return parseQdrantHostname(trimmedUrl)
	}

	try {
		new URL(trimmedUrl)
		return trimmedUrl
	} catch {
		return parseQdrantHostname(trimmedUrl)
	}
}

export function createQdrantClient(parsedUrl: string, apiKey?: string): QdrantClient {
	try {
		const urlObj = new URL(parsedUrl)

		let port: number
		let useHttps: boolean

		if (urlObj.port) {
			port = Number(urlObj.port)
			useHttps = urlObj.protocol === "https:"
		} else {
			if (urlObj.protocol === "https:") {
				port = 443
				useHttps = true
			} else {
				port = 80
				useHttps = false
			}
		}

		return new QdrantClient({
			host: urlObj.hostname,
			https: useHttps,
			port,
			prefix: urlObj.pathname === "/" ? undefined : urlObj.pathname.replace(/\/+$/, ""),
			apiKey,
			headers: {
				"User-Agent": "Jabberwock",
			},
		})
	} catch {
		return new QdrantClient({
			url: parsedUrl,
			apiKey,
			headers: {
				"User-Agent": "Jabberwock",
			},
		})
	}
}
