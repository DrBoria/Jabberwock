import { describe, expect, it } from "vitest"
import * as http from "node:http"
import { WebSocket } from "ws"
import { PROTOCOL_VERSION } from "@jabberwock/types"
import { WsServerCore } from "./ws-server-core.js"
import { ClientRegistry } from "./client-registry.js"
import { createTestCapabilities } from "./test-utils.js"

interface Envelope {
	protocolVersion: number
	clientId?: string
	sentAt: number
	body: { type: string; [key: string]: unknown }
}

function connect(port: number): Promise<WebSocket> {
	return new Promise((resolve, reject) => {
		const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`)
		ws.on("open", () => resolve(ws))
		ws.on("error", (error) => reject(error))
	})
}

function nextMessage(ws: WebSocket): Promise<Envelope> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error("message timeout")), 4000)
		ws.once("message", (data) => {
			clearTimeout(timer)
			resolve(JSON.parse(data.toString()) as Envelope)
		})
	})
}

function hello(clientKind = "browser"): string {
	return JSON.stringify({
		protocolVersion: PROTOCOL_VERSION,
		sentAt: Date.now(),
		body: { type: "hello", clientKind },
	})
}

interface Harness {
	core: WsServerCore
	port: number
	close: () => Promise<void>
}

/** Each test gets its own isolated server + core so the registry never leaks across tests. */
function makeCore(getState?: () => Record<string, unknown>): Promise<Harness> {
	return new Promise((resolve, reject) => {
		const server = http.createServer()
		const core = new WsServerCore({ server, getState })
		core.start(createTestCapabilities())
		server.on("error", reject)
		server.listen(0, "127.0.0.1", () => {
			const port = (server.address() as { port: number }).port
			resolve({
				core,
				port,
				close: () =>
					new Promise<void>((res) => {
						core.stop()
						server.close(() => res())
					}),
			})
		})
	})
}

async function handshake(h: Harness, ws: WebSocket, kind = "browser"): Promise<Envelope> {
	const state = nextMessage(ws)
	ws.send(hello(kind))
	return state
}

describe("WsServerCore", () => {
	it("completes the hello → state handshake with _hydration and a clientId", async () => {
		const h = await makeCore(() => ({ hydrated: true }))
		try {
			const ws = await connect(h.port)
			const env = await handshake(h, ws)
			expect(env.protocolVersion).toBe(PROTOCOL_VERSION)
			expect(env.clientId).toBeTruthy()
			expect(env.body.type).toBe("state")
			expect(env.body._hydration).toBe(true)
			expect(env.body.state).toEqual({ hydrated: true })
			ws.close()
		} finally {
			await h.close()
		}
	})

	it("registers the client in the registry after the handshake", async () => {
		const h = await makeCore()
		try {
			const ws = await connect(h.port)
			const env = await handshake(h, ws, "smartwatch")
			const client = h.core.registry.get(env.clientId as string)
			expect(client).toBeDefined()
			expect(client?.clientKind).toBe("smartwatch")
			expect(h.core.registry.size).toBe(1)
			ws.close()
		} finally {
			await h.close()
		}
	})

	it("rejects a non-handshaked frame with not-handshaked", async () => {
		const h = await makeCore()
		try {
			const ws = await connect(h.port)
			const err = nextMessage(ws)
			ws.send(JSON.stringify({ protocolVersion: PROTOCOL_VERSION, sentAt: Date.now(), body: { type: "chat" } }))
			const env = await err
			expect(env.body.type).toBe("error")
			expect(env.body.code).toBe("not-handshaked")
			ws.close()
		} finally {
			await h.close()
		}
	})

	it("rejects malformed JSON with malformed-json", async () => {
		const h = await makeCore()
		try {
			const ws = await connect(h.port)
			const err = nextMessage(ws)
			ws.send("this is not json")
			const env = await err
			expect(env.body.type).toBe("error")
			expect(env.body.code).toBe("malformed-json")
			ws.close()
		} finally {
			await h.close()
		}
	})

	it("rejects a bad envelope with bad-envelope", async () => {
		const h = await makeCore()
		try {
			const ws = await connect(h.port)
			const err = nextMessage(ws)
			ws.send(JSON.stringify({ protocolVersion: 999, sentAt: Date.now(), body: { type: "hello" } }))
			const env = await err
			expect(env.body.type).toBe("error")
			expect(env.body.code).toBe("bad-envelope")
			ws.close()
		} finally {
			await h.close()
		}
	})

	it("broadcasts sendOutbound to all connected clients", async () => {
		const h = await makeCore()
		try {
			const wsA = await connect(h.port)
			const wsB = await connect(h.port)
			await handshake(h, wsA)
			await handshake(h, wsB)

			const pA = nextMessage(wsA)
			const pB = nextMessage(wsB)
			h.core.sendOutbound({ type: "ping", value: 1 })
			const [msgA, msgB] = await Promise.all([pA, pB])

			expect(msgA.body.type).toBe("ping")
			expect(msgB.body.type).toBe("ping")
			wsA.close()
			wsB.close()
		} finally {
			await h.close()
		}
	})

	it("delivers targeted sendOutbound only to the named client", async () => {
		const h = await makeCore()
		try {
			const wsA = await connect(h.port)
			const wsB = await connect(h.port)
			const envA = await handshake(h, wsA)
			const envB = await handshake(h, wsB)

			const msgA = nextMessage(wsA)
			const msgB = nextMessage(wsB)
			h.core.sendOutbound({ type: "targeted" }, { kind: "client", clientId: envA.clientId as string })

			expect((await msgA).body.type).toBe("targeted")
			const bGot = await Promise.race([
				msgB.then(() => true),
				new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 300)),
			])
			expect(bGot).toBe(false)
			expect(h.core.registry.get(envA.clientId as string)).toBeDefined()
			expect(h.core.registry.get(envB.clientId as string)).toBeDefined()
			wsA.close()
			wsB.close()
		} finally {
			await h.close()
		}
	})

	it("dispatches inbound frames to onInbound handlers with the client id", async () => {
		const h = await makeCore()
		try {
			const ws = await connect(h.port)
			const env = await handshake(h, ws)

			const received: Array<{ clientId: string; bodyType: string }> = []
			h.core.onInbound((clientId, body) => {
				received.push({ clientId, bodyType: body.type })
			})

			ws.send(
				JSON.stringify({
					protocolVersion: PROTOCOL_VERSION,
					sentAt: Date.now(),
					body: { type: "chat", text: "hi" },
				}),
			)
			await new Promise((resolve) => setTimeout(resolve, 50))

			expect(received.length).toBe(1)
			expect(received[0]?.clientId).toBe(env.clientId)
			expect(received[0]?.bodyType).toBe("chat")
			ws.close()
		} finally {
			await h.close()
		}
	})
})

describe("ClientRegistry", () => {
	function fakeSocket(): WebSocket {
		return { on: () => {} } as unknown as WebSocket
	}

	it("resolves broadcast to all sockets and targeted to one", () => {
		const registry = new ClientRegistry()
		const socketA = fakeSocket()
		const socketB = fakeSocket()
		registry.register({ clientId: "a", clientKind: "browser", socket: socketA, connectedAt: 1 })
		registry.register({ clientId: "b", clientKind: "smartwatch", socket: socketB, connectedAt: 2 })

		expect(registry.resolve({ kind: "broadcast" })).toHaveLength(2)
		expect(registry.resolve({ kind: "client", clientId: "a" })).toEqual([socketA])
		expect(registry.resolve({ kind: "client", clientId: "missing" })).toHaveLength(0)
		expect(registry.size).toBe(2)
	})

	it("unregisters a client by id", () => {
		const registry = new ClientRegistry()
		registry.register({ clientId: "a", clientKind: "browser", socket: fakeSocket(), connectedAt: 1 })
		expect(registry.size).toBe(1)
		registry.unregister("a")
		expect(registry.size).toBe(0)
	})
})
