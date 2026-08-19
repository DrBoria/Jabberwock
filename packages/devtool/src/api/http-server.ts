import { createServer, type Server } from "http"

const BUILD_TIMESTAMP = new Date().toISOString()

let server: Server | null = null

/**
 * Start a simple HTTP status server on the given port.
 * Provides a `/status` endpoint returning build timestamp and connection info.
 * The standalone stdio MCP process polls this endpoint to detect when the
 * extension has finished reloading.
 */
export function startHttpStatusServer(port: number = 60061): Promise<number> {
	return new Promise((resolve, reject) => {
		// If already running, return the port
		if (server) {
			const addr = server.address()
			if (addr && typeof addr === "object") {
				resolve(addr.port)
				return
			}
		}

		server = createServer((req, res) => {
			if (req.url === "/status" && req.method === "GET") {
				res.writeHead(200, {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*",
				})
				res.end(
					JSON.stringify({
						status: "ok",
						buildTimestamp: BUILD_TIMESTAMP,
						uptime: process.uptime(),
					}),
				)
				return
			}

			res.writeHead(404)
			res.end("Not found")
		})

		server.on("error", (err: Error) => {
			reject(err)
		})

		server.on("listening", () => {
			const addr = server!.address()
			const actualPort = typeof addr === "object" && addr ? addr.port : port
			resolve(actualPort)
		})

		server.listen(port, "127.0.0.1")
	})
}

export function stopHttpStatusServer(): void {
	if (server) {
		server.close()
		server = null
	}
}

export function getBuildTimestamp(): string {
	return BUILD_TIMESTAMP
}
