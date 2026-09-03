/**
 * C3 GATE boot helper - hermetic server bootstrap for the command-surface gate test.
 *
 * Extracted from c3-command-surface-gate.test.ts to keep the test file under the
 * max-lines limit and the beforeAll callback under the complexity limit.
 *
 * The handler registration (registerOnTaskIntents, registerOnMessagesIntents, etc.)
 * is injected as a callback so this file does not import from events/handlers/
 * (which would violate the no-misplaced-concern rule for non-test files).
 */

import { mkdtempSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import http from "node:http"
import type { RawData } from "ws"
import { WebSocket } from "ws"
import nock from "nock"

import { createTelemetryService } from "@jabberwock/telemetry"
import { createMcpServerManager } from "@services/mcp/core/McpServerManager"
import { getSettingsAccess } from "@utils/settings"
import { createServerCapabilities } from "@connectors/web/backend/capabilities"
import { WebWsServer } from "@connectors/web/backend/ws/web-ws-server"

import { startBackend } from "./bootstrap"
import { installBackendState } from "@features/foundation/host-context/context"
import { FakeAIHandler } from "@api/providers/fake-ai/handler"
import { createBackendRootStore, getIntentBus } from "@features/backendroot/store"
import type { IntentBus } from "@features/intents/bus"

// -- Small helpers (no `any`; frames are narrowed at the boundary) ----------------

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** Bounded polling wait with a descriptive timeout error. */
export async function waitFor<T>(probe: () => T | undefined, timeoutMs: number, label: string): Promise<T> {
	const deadline = Date.now() + timeoutMs
	for (;;) {
		const value = probe()
		if (value !== undefined) return value
		if (Date.now() >= deadline) throw new Error(`C3 gate test timed out waiting for ${label}`)
		await sleep(5)
	}
}

/** Narrow an unknown JSON value to a plain object record, or undefined. */
export function asRecord(value: unknown): Record<string, unknown> | undefined {
	return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined
}

/** Convert a ws RawData frame (string | Buffer | ArrayBuffer | Buffer[]) to UTF-8 text. */
function toUtf8(data: RawData): string {
	if (typeof data === "string") return data
	if (Buffer.isBuffer(data)) return data.toString("utf8")
	if (Array.isArray(data)) return Buffer.concat(data).toString("utf8")
	return Buffer.from(new Uint8Array(data)).toString("utf8")
}

/** Extract `body` from a received server->client envelope frame (undefined on malformed frames). */
export function extractBody(data: RawData): Record<string, unknown> | undefined {
	const text = toUtf8(data)
	let parsed: unknown
	try {
		parsed = JSON.parse(text)
	} catch {
		return undefined
	}
	const envelope = asRecord(parsed)
	if (!envelope || !asRecord(envelope.body)) return undefined
	return asRecord(envelope.body)
}

export interface StreamChunkRef {
	taskId: string
	text: string
}

/** Collect streamChunk frames from a slice of received bodies. */
export function readStreamChunks(bodies: Array<Record<string, unknown>>): StreamChunkRef[] {
	const out: StreamChunkRef[] = []
	for (const body of bodies) {
		if (body.type !== "streamChunk") continue
		const taskId = typeof body.taskId === "string" ? body.taskId : undefined
		const text = typeof body.text === "string" ? body.text : undefined
		if (taskId && text !== undefined) out.push({ taskId, text })
	}
	return out
}

// -- Hermetic LLM ----------------------------------------------------------------

const FAKE_WORDS = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel"] as const

function makeFakeAI(): { [key: string]: unknown } {
	return {
		id: "gate-fake-ai",
		async *createMessage(_systemPrompt: string, _messages: Array<Record<string, unknown>>) {
			for (const word of FAKE_WORDS) {
				await sleep(45)
				yield { type: "text" as const, text: ` ${word}` }
			}
			yield { type: "usage" as const, inputTokens: 120, outputTokens: 96 }
		},
		getModel(): { id: string; info: Record<string, unknown> } {
			return { id: "gate-model", info: { contextWindow: 200_000, supportsPromptCache: false } }
		},
		countTokens(_content: Array<Record<string, unknown>>): Promise<number> {
			return Promise.resolve(48)
		},
		completePrompt(prompt: string): Promise<string> {
			return Promise.resolve(`fake:${prompt.slice(0, 16)}`)
		},
	}
}

// -- Boot result -----------------------------------------------------------------

export interface GateBootResult {
	tmpDir: string
	httpServer: http.Server
	connector: WebWsServer
	bridge: Awaited<ReturnType<typeof startBackend>>
	rootStore: ReturnType<typeof createBackendRootStore>
	bus: IntentBus
	wsClient: WebSocket
}

// -- Boot ------------------------------------------------------------------------

/**
 * Boots the hermetic C3 gate environment: capabilities, host state, telemetry, MCP,
 * WebWsServer, backend bridge, root store, intent bus, fake AI, and WS client.
 *
 * The `registerHandlers` callback is called after the intent bus is created but before
 * `bus.setProvider(bridge)`, so the test file can register all intent handlers without
 * this file importing from events/handlers/ directories.
 */
export async function bootGateEnvironment(
	registerHandlers: (bus: IntentBus) => void,
	receivedBodies: Array<Record<string, unknown>>,
): Promise<GateBootResult> {
	const tmpDir = mkdtempSync(path.join(os.tmpdir(), "c3-gate-"))
	nock.enableNetConnect("127.0.0.1")

	const capabilities = await createServerCapabilities({
		dataDir: path.join(tmpDir, "data"),
		workspaceRoot: path.join(tmpDir, "workspace"),
	})

	installBackendState({
		hashmapMemory: capabilities.hashmapMemory,
		extensionRootPath: tmpDir,
		globalStoragePath: path.join(tmpDir, "data"),
		isDevelopmentMode: true,
	})

	createTelemetryService([])
	createMcpServerManager()
	await getSettingsAccess().setValue("mcpEnabled", false)

	const httpServer = http.createServer()
	const connector = new WebWsServer({
		port: 0,
		bindAddress: "127.0.0.1",
		serveStatic: false,
		server: httpServer,
		getState: () => ({ gateTestHandshake: true }),
	})
	if (!connector) throw new Error("C3 gate test: connector not created")

	const bridge = await startBackend({ connector, capabilities })
	const rootStore = createBackendRootStore()
	const bus = getIntentBus()
	if (!bus || !bridge) throw new Error("C3 gate test: intent bus or bridge missing after boot")

	registerHandlers(bus)
	bus.setProvider(bridge)

	new FakeAIHandler({ fakeAi: makeFakeAI() })
	rootStore.settings.apiConfig.setConfiguration({
		apiProvider: "fake-ai",
		apiModelId: "gate-model",
		baseUrl: "",
		apiKey: "",
		fakeAi: makeFakeAI(),
	})
	rootStore.foundation.windowManager.setView({ webview: { postMessage: () => undefined } })

	const addr = httpServer.address()
	if (!addr || typeof addr === "string") throw new Error("C3 gate test: expected a numeric server address")

	const wsClient = new WebSocket(`ws://127.0.0.1:${addr.port}/ws`)
	await waitFor(
		() => (wsClient && wsClient.readyState === WebSocket.OPEN ? true : undefined),
		5_000,
		"WS client open",
	)
	wsClient.on("message", (data: RawData) => {
		const body = extractBody(data)
		if (body) receivedBodies.push(body)
	})

	return { tmpDir, httpServer, connector, bridge, rootStore, bus, wsClient }
}
