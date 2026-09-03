import { afterAll, beforeAll, describe, expect, it } from "vitest"
import * as http from "node:http"
import * as os from "node:os"
import * as path from "node:path"
import * as fs from "node:fs"
import { WebSocket } from "ws"
import { createServerCapabilities } from "./capabilities.ts"
import { WebWsServer } from "./ws/web-ws-server.ts"
import { PROTOCOL_VERSION } from "../../../packages/types/src/protocol/envelope.ts"

/**
 * v4 Phase C1 standalone runtime smoke: /healthz responds and a WS client completes the
 * hello → state handshake (§6.2). Uses an ephemeral port + temp data dir so it runs
 * without the C2 `startBackend()` bootstrap.
 */
describe("web connector backend core", () => {
	const port = 0 // ephemeral
	const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "jabberwock-web-"))
	let server: http.Server
	let connector: WebWsServer
	let boundPort: number

	beforeAll(async () => {
		server = http.createServer()
		server.on("request", (req, res) => {
			// Mirrors the /healthz route wired in main.ts (the connector itself does not own it).
			const url = new URL(req.url ?? "/", "http://localhost")
			if (url.pathname === "/healthz") {
				res.writeHead(200, { "Content-Type": "application/json" })
				res.end(JSON.stringify({ status: "ok", uptime: process.uptime() }))
				return
			}
			res.writeHead(404, { "Content-Type": "text/plain" })
			res.end("Not Found")
		})
		const capabilities = await createServerCapabilities({
			dataDir,
			workspaceRoot: dataDir,
			env: {},
		})
		connector = new WebWsServer({ port, bindAddress: "127.0.0.1", serveStatic: false, server })
		await connector.start(capabilities)
		boundPort = (server.address() as { port: number }).port
	})

	afterAll(async () => {
		await connector.stop()
		fs.rmSync(dataDir, { recursive: true, force: true })
	})

	it("responds to /healthz with liveness JSON", async () => {
		const res = await fetch(`http://127.0.0.1:${boundPort}/healthz`)
		expect(res.status).toBe(200)
		const body = (await res.json()) as { status: string }
		expect(body.status).toBe("ok")
	})

	it("completes the hello → state WS handshake with a ConnectorEnvelope frame", async () => {
		const frame = await new Promise<unknown>((resolve, reject) => {
			const ws = new WebSocket(`ws://127.0.0.1:${boundPort}/ws`)
			const timer = setTimeout(() => reject(new Error("handshake timeout")), 5000)
			ws.on("message", (data) => {
				clearTimeout(timer)
				resolve(JSON.parse(data.toString()))
				ws.close()
			})
			ws.on("error", (error) => {
				clearTimeout(timer)
				reject(error)
			})
			ws.on("open", () => {
				ws.send(
					JSON.stringify({
						protocolVersion: PROTOCOL_VERSION,
						sentAt: Date.now(),
						body: { type: "hello", clientKind: "browser" },
					}),
				)
			})
		})

		const envelope = frame as {
			protocolVersion: number
			clientId?: string
			body: { type: string; _hydration?: boolean }
		}
		expect(envelope.protocolVersion).toBe(PROTOCOL_VERSION)
		expect(envelope.clientId).toBeTruthy()
		expect(envelope.body.type).toBe("state")
		expect(envelope.body._hydration).toBe(true)
	})
})
