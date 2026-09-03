import * as fs from "node:fs"
import * as http from "node:http"
import { startBackend } from "@startup/bootstrap"
import type { BackendCapabilities } from "@jabberwock/types"
import { createServerCapabilities } from "./capabilities.ts"
import { parseServerConfig, type ServerConfig } from "./config.ts"
import { StaticFileServer } from "./static/file-server.ts"
import { WebWsServer } from "./ws/web-ws-server.ts"
import { getContextWindowMeta } from "@features/context"

/**
 * v4 Phase C2 (§7.2): standalone server entrypoint for the web connector backend.
 *
 * This is the esbuild `server.js` target entry. It builds the default capabilities
 * (file-backed hashmapMemory, in-memory queue, topic pubsub, chokidar watchers), constructs
 * the WebSocket connector on `/ws`, exposes `/healthz`, optionally serves the built SPA in
 * single-container simple mode (§7.3), and boots the shared `startBackend()` composition root
 * (§7.1) so the hello → state handshake returns fully-bootstrapped backend state.
 */
export async function main(): Promise<void> {
	const config = parseServerConfig(process.argv.slice(2), process.env)

	const capabilities = await createServerCapabilities({
		dataDir: config.dataDir,
		workspaceRoot: config.workspaceRoot,
		env: process.env,
		logger: {
			info: (...args: unknown[]) => console.log("[jabberwock-server]", ...args),
			warn: (...args: unknown[]) => console.warn("[jabberwock-server]", ...args),
		},
	})

	const httpServer = http.createServer()

	// /healthz — liveness for container healthchecks (§6.1 / §9.1).
	httpServer.on("request", (req, res) => {
		const url = new URL(req.url ?? "/", "http://localhost")
		if (url.pathname === "/healthz") {
			res.writeHead(200, { "Content-Type": "application/json" })
			res.end(JSON.stringify({ status: "ok", uptime: process.uptime() }))
			return
		}
		if (config.serveStatic) {
			const staticServer = new StaticFileServer(config.staticDir)
			if (staticServer.handle(req, res)) return
		}
		res.writeHead(404, { "Content-Type": "text/plain" })
		res.end("Not Found")
	})

	// Static serving is only enabled when the build output exists (single-container mode).
	if (config.serveStatic) {
		if (fs.existsSync(config.staticDir)) {
			capabilities.logger?.info(`Serving static frontend from ${config.staticDir}`)
		} else {
			capabilities.logger?.warn(
				`--serve-static requested but build dir not found at ${config.staticDir}; static serving disabled`,
			)
		}
	}

	const connector = new WebWsServer({
		port: config.port,
		bindAddress: config.bindAddress,
		serveStatic: config.serveStatic,
		staticDir: config.staticDir,
		server: httpServer,
		// Phase C2: the hello → state handshake hands the client the bootstrapped backend state.
		getState: () => buildServerState(config, capabilities),
	})

	// Phase C2 (§7.1): shared backend bootstrap — connector.start + EventBridge + provider
	// registry + inbound wiring + logger slot (единственная точка старта для обоих режимов).
	await startBackend({ connector, capabilities })
	capabilities.logger?.info(
		`Web connector listening on ws://${config.bindAddress}:${config.port}/ws (bind=${config.bindMode})`,
	)
}

/**
 * Build the server-mode `state` payload for the hello → state handshake (§6.2).
 *
 * Reflects the backend application state the shared bootstrap actually initialized: the
 * transport connector, workspace/storage roots from the host context, and the capability
 * slots backing the server.
 *
 * NOTE: the full MST root-store snapshot (as produced in extension mode by
 * `createBackendRootStore`) is not yet bundleable server-side — its import graph still pulls
 * "vscode" from 21 modules (reports/audit-platform.json still lists 100 backend files), which
 * would violate criterion C-2 (§8.3). Full store hydration lands once that purity debt is
 * cleared; until then this payload IS the bootstrapped backend state.
 */
export function buildServerState(config: ServerConfig, capabilities: BackendCapabilities): Record<string, unknown> {
	return {
		connectorId: "web",
		transport: "websocket",
		workspaceRoot: capabilities.hostContext.workspaceRoot,
		storageDir: capabilities.hostContext.storageDir,
		workspaceFolders: capabilities.hostContext.workspaceFolders ?? [],
		dataDir: config.dataDir,
		context: { tasks: getContextWindowMeta() }, // ICG-C1 (§7.3 bounded handshake): minimal per-task archive metadata only - content never enters hello->state; heavy pages arrive via explicit range fetches (ICG-D1)
		capabilities: {
			memory: "file-backed-hashmap",
			queue: "in-memory",
			pubsub: "in-process-topic",
			secrets: "file-secret-store",
			fileWatchers: "chokidar",
		},
	}
}

// This file is the server entrypoint (esbuild `server.js` target and `pnpm start:server`),
// so it always starts the server. `import.meta.url` is intentionally avoided because the
// esbuild target bundles to CommonJS, where it is unavailable.
main().catch((error) => {
	console.error("[jabberwock-server] fatal:", error)
	process.exit(1)
})
