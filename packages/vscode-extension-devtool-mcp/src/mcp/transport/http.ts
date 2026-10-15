/**
 * HTTP Status Server
 *
 * A lightweight HTTP server that provides a /status endpoint for
 * extension host identification. This allows the stdio proxy to identify
 * which window it's talking to.
 *
 * The server listens on a fixed port (60061) and returns:
 * - buildTimestamp: ISO string of when the extension was loaded
 * - uptime: process uptime in seconds
 * - pid: process ID
 * - workspaceFolder: current workspace folder name
 * - focused: whether the window is currently focused
 */

import * as http from "node:http"
import type { AddressInfo } from "node:net"
import { HTTP_STATUS_PORT } from "./errors.js"

/**
 * Build timestamp is captured at module load time (when the extension
 * host loads the module). This is the most reliable timestamp.
 */
const BUILD_TIMESTAMP = new Date().toISOString()

/**
 * Lazy workspace identity.
 *
 * The extension host may not have a workspace open yet when the status
 * server starts (e.g. extension activation before workspace is ready).
 * We use lazy getters so the /status endpoint always returns the CURRENT
 * workspace, even if it changes after the server started.
 */
export interface HostIdentity {
	workspaceFolder?: string
	getWorkspaceFolder?: () => string | undefined
	getFocused?: () => boolean
}

let statusServer: http.Server | null = null
let statusPort: number | null = null

/**
 * Answer a /status request: CORS headers, OPTIONS preflight, then the
 * current (lazily resolved) identity as a JSON body.
 */
function serveStatus(res: http.ServerResponse, method: string | undefined, identity?: HostIdentity): void {
	res.setHeader("Access-Control-Allow-Origin", "*")
	res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
	res.setHeader("Access-Control-Allow-Headers", "Content-Type")

	if (method === "OPTIONS") {
		res.writeHead(204)
		res.end()
		return
	}

	// Get current identity (lazy - always fresh)
	const workspaceFolder = identity?.getWorkspaceFolder?.() ?? identity?.workspaceFolder ?? "no-workspace"
	const focused = identity?.getFocused?.() ?? true

	res.writeHead(200, { "Content-Type": "application/json" })
	res.end(
		JSON.stringify({
			status: "ok",
			buildTimestamp: BUILD_TIMESTAMP,
			uptime: Math.round(process.uptime()),
			pid: process.pid,
			workspaceFolder,
			focused,
		}),
	)
}

/**
 * Start the HTTP status server.
 *
 * @param port - Port to listen on (default: 60061)
 * @param identity - Lazy identity provider for the extension host
 * @returns The actual port the server is listening on
 */
export function startHttpStatusServer(port = HTTP_STATUS_PORT, identity?: HostIdentity): Promise<number> {
	return new Promise((resolve, reject) => {
		if (statusServer) {
			resolve(statusPort!)
			return
		}

		const server = http.createServer((req, res) => {
			if (req.url === "/status") {
				serveStatus(res, req.method, identity)
			} else {
				res.writeHead(404)
				res.end()
			}
		})

		server.listen(port, "127.0.0.1", () => {
			const addr = server.address() as AddressInfo
			statusServer = server
			statusPort = addr.port
			console.log(`[DevtoolServer] HTTP status server started on port ${addr.port}`)
			resolve(addr.port)
		})

		server.on("error", (err) => {
			reject(err)
		})
	})
}

/**
 * Stop the HTTP status server.
 */
export function stopHttpStatusServer(): void {
	if (statusServer) {
		statusServer.close()
		statusServer = null
		statusPort = null
	}
}

/**
 * Get the build timestamp (captured at module load).
 */
export function getBuildTimestamp(): string {
	return BUILD_TIMESTAMP
}
