import * as fs from "node:fs"
import * as http from "node:http"
import { startBackend } from "@startup/bootstrap"
import { setBackendCapabilities } from "@features/foundation/capabilities/registry"
import { getBackendRootSnapshot } from "@features/storeSingleton"
import { installBackendState } from "@features/foundation/host-context/context"
import { createServerCapabilities } from "./capabilities.ts"
import { parseServerConfig } from "./config.ts"
import { StaticFileServer } from "./static/file-server.ts"
import { WebWsServer } from "./ws/web-ws-server.ts"

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
	})

	// Install capabilities into the process-wide registry so the shared backend task graph
	// (startNewTask, getTheme, etc.) can resolve host-neutral capability slots. The vscode
	// extension does the same in its activation; the web server is the second host that needs it.
	setBackendCapabilities(capabilities)

	// Backend state slots for getHostEnvironment() consumers (postStateToWebview → buildEnrichedState
	// reads host paths at runtime). The vscode extension installs the same slots from its activation
	// context (initializeCoreSetup); in server mode the file-backed capability is the memento source.
	// Without this, the first postStateToWebview crashes with "Backend state not initialized".
	installBackendState({
		hashmapMemory: capabilities.hashmapMemory,
		extensionRootPath: config.dataDir,
		globalStoragePath: config.dataDir,
		isDevelopmentMode: true,
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
		// D4g PART 2: the hello → state handshake hands the client the full MST root-store snapshot.
		getState: getBackendRootSnapshot,
	})

	// Phase C2 (§7.1): shared backend bootstrap — connector.start + EventBridge + provider
	// registry + inbound wiring + logger slot (единственная точка старта для обоих режимов).
	await startBackend({ connector, capabilities })
	capabilities.logger?.info(
		`Web connector listening on ws://${config.bindAddress}:${config.port}/ws (bind=${config.bindMode})`,
	)
}

// This file is the server entrypoint (esbuild `server.js` target and `pnpm start:server`),
// so it always starts the server. `import.meta.url` is intentionally avoided because the
// esbuild target bundles to CommonJS, where it is unavailable.
main().catch((error) => {
	console.error("[jabberwock-server] fatal:", error)
	process.exit(1)
})
