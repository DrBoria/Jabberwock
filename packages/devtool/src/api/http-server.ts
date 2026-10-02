import { createServer, type Server } from "http"

const BUILD_TIMESTAMP = new Date().toISOString()

let server: Server | null = null

/**
 * Identity of the extension host window that owns this devtool server.
 * Returned by `/status` so the standalone stdio MCP proxy can tell the agent
 * WHICH window/surface it is talking to (prevents debugging the wrong window).
 */
export interface TargetIdentity {
	workspaceFolder?: string | null
	/**
	 * Lazy getter for the workspace folder. Passed as a callback (NOT read at
	 * activation time) because the workspace folders may not be resolved yet
	 * when the extension activates — reading it lazily at `/status` time avoids
	 * a stale `null` (which surfaced as "unknown-workspace" in tool labels).
	 */
	getWorkspaceFolder?: () => string | null
	/**
	 * Lazy getter for the window focus state. Passed as a callback (NOT read
	 * at import time) because this module is also imported by the standalone
	 * stdio MCP proxy, which runs in plain node WITHOUT the `vscode` module.
	 */
	getFocused?: () => boolean | null
}

let targetIdentity: TargetIdentity = { workspaceFolder: null, getFocused: () => null }

/**
 * Start a simple HTTP status server on the given port.
 * Provides a `/status` endpoint returning build timestamp, uptime, and the
 * identity of the window this server belongs to (workspace folder + focus).
 * The standalone stdio MCP process polls this endpoint to detect when the
 * extension has finished reloading AND to report the target to the agent.
 */
export function startHttpStatusServer(port: number = 60061, identity?: TargetIdentity): Promise<number> {
	return new Promise((resolve, reject) => {
		// If already running, return the port
		if (server) {
			const addr = server.address()
			if (addr && typeof addr === "object") {
				resolve(addr.port)
				return
			}
		}
		if (identity) {
			targetIdentity = identity
		}

		server = createServer((req, res) => {
			if (req.url === "/status" && req.method === "GET") {
				res.writeHead(200, {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*",
				})
				let focused: boolean | null = null
				try {
					focused = targetIdentity.getFocused?.() ?? null
				} catch {
					focused = null
				}
				// Lazy workspace read: prefer the getter (resolved at request time)
				// over the static value captured at activation (which may be null if
				// folders were not ready yet).
				let workspaceFolder: string | null | undefined = targetIdentity.workspaceFolder
				try {
					const fromGetter = targetIdentity.getWorkspaceFolder?.()
					if (typeof fromGetter === "string") {
						workspaceFolder = fromGetter
					}
				} catch {
					// keep the static value
				}
				res.end(
					JSON.stringify({
						status: "ok",
						buildTimestamp: BUILD_TIMESTAMP,
						uptime: process.uptime(),
						pid: process.pid,
						workspaceFolder,
						focused,
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
