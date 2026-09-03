/**
 * ICG-C2 acceptance support library - protocol constants, fixture generation and a ws test client
 * headless two-client artifact context-two-client.mjs; spec anchor: ICG plan ~L382.
 */

import WebSocket from "ws"

// Protocol literals verified against source - keep in sync with packages/types/src/protocol.
// PROTOCOL_VERSION per packages/types/src/protocol/envelope.ts L21.
const PROTOCOL_VERSION = 1
export const T = {
	// Request frames FE->BE (contextEventNames, packages/types/src/protocol/context.ts L186-213).
	searchRequested: "context.search.requested",
	recallRequested: "context.recall.requested",
	describeRequested: "context.describe.requested",
	historyRangeRequested: "context.history.range.requested",
	// Cancel frame type = CHAT_TASK_CANCEL_TASK (packages/types/src/events/chat/constants.ts L41).
	cancelTask: "cancelTask",
	// Response/ack frames BE->FE only - never ride the IntentBus (§8.2 decision).
	searchResponse: "context.search.response",
	recallResponse: "context.recall.response",
	describeResponse: "context.describe.response",
	historyChunk: "context.history.chunk", // chunk/completed literals live in actions/index.ts
	historyCompleted: "context.history.completed",
	historyCancelled: "context.history.cancelled"
}

export const TASK_ID = "task-acceptance" // must match the tasks/<id> directory name under --data-dir.
// Spec: ~50k messages / tens of millions of tokens (word counts below land near the low end).
export const MESSAGE_COUNT = 50_000
// Message number carrying a thinking block (= middle anchor; the §6.4 byte-for-byte check rides here).
export const MID_NUM = Math.floor(MESSAGE_COUNT / 2)
// C4-only page size [D-c4-cancel-page-size]: small pages stretch the full-task span into thousands of chunks (~6250 at MESSAGE_COUNT=50k) so the cancel sent after chunk #3 lands deterministically mid-delivery. At larger sizes loopback delivery can finish before the client's poll cycle ends, and by then the in-flight registry entry is gone - a post-completion cancel must not ack (observed race: 8/9 run).
export const CANCEL_PAGE_SIZE = 8
export const LOCATOR_PROBES = 30 // distinct locators for the p95 sweep (C2).
export const RECALL_ROUNDS = 5 // samples per locator -> 150 timed recalls total.
// Archive reconciliation of the ~8M-word fixture can be slow - waitArchiveReady prints every 30s.
const READY_TIMEOUT_MS = 600_000

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

export function markerFor(num) {
	// Single alphanumeric token per message number - unicode61 FTS-safe and unique (C1 archive conventions).
	return `CTXMKR${String(num).padStart(6, "0")}`
}

const VOCAB = [
	"context", "archive", "recall", "boundary", "anchor", "sequence", "message", "token",
	"window", "manifest", "node", "summary", "chunk", "delivery", "cancel", "request",
	"response", "client", "server", "socket", "envelope", "protocol", "version", "storage",
	"graph", "infinite", "history", "range", "page", "cursor", "offset", "limit",
	"scope", "filter", "role", "content", "thinking", "block", "parity", "budget",
	"clamp", "priority", "bucket", "intent", "bus", "reconcile", "ingest", "tail"
]

export function fixtureRole(index) {
	// Deterministic role mix: user/assistant alternating with a tool message every fourth.
	return index % 4 === 3 ? "tool" : index % 2 === 1 ? "assistant" : "user"
}

function mulberry32(seed) {
	let a = seed >>> 0
	return function next() {
		a |= 0
		a = (a + 0x6d2b79f5) | 0
		let t = Math.imul(a ^ (a >>> 15), 1 | a)
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

export function buildFixtureMessages() {
	// Fixed PRNG seed -> byte-reproducible archive across runs [spec: deterministic generation].
	const rng = mulberry32(48271)
	let totalWords = 0
	const messages = []
	for (let i = 0; i < MESSAGE_COUNT; i += 1) {
		const num = i + 1
		const wordCount = 120 + Math.floor(rng() * 80) // avg ~160 words/message -> several-million-token class.
		totalWords += wordCount
		const words = []
		for (let w = 0; w < wordCount; w += 1) words.push(VOCAB[Math.floor(rng() * VOCAB.length)])
		const textPart = { type: "text", text: `${markerFor(num)} ${words.join(" ")}` }
		// Middle anchor carries a thinking block so the §6.4 byte-for-byte parity check rides on it (C1-mid).
		const thinkText = `internal reasoning for step ${num}: verify boundary metadata before recall`
		const thinkingPart = { type: "thinking", text: thinkText }
		const content = num === MID_NUM ? [thinkingPart, textPart] : [textPart]
		messages.push({ id: `msg-${num}`, role: fixtureRole(i), ts: 1_700_000_000_000 + i * 60_000, content })
	}
	return { messages, totalWords }
}

export function extractNodeIds(rawText) {
	// All nodeId literals anywhere in a raw frame - layout-independent extraction.
	return [...String(rawText).matchAll(/"nodeId"\s*:\s*"([^"]+)"/g)].map(m => m[1])
}

export class TestClient {
	constructor(name, url) {
		this.name = name
		this.url = url
		// All received frames as { raw, env }; env is the parsed envelope or null for non-JSON frames.
		this.frames = []
		// consumeNext scans from here; single-flight requests keep this unambiguous.
		this.cursor = 0
		this.clientId = null
		this.protocolErrors = 0
		this.ws = null
	}

	async connect(timeoutMs) {
		this.ws = new WebSocket(this.url)
		await new Promise((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error(`${this.name}: ws open timeout`)), timeoutMs)
			this.ws.once("open", () => {
				clearTimeout(timer)
				resolve()
			})
			this.ws.once("error", err => {
				clearTimeout(timer)
				reject(err instanceof Error ? err : new Error(String(err)))
			})
		})
		this.ws.on("message", data => this.onMessage(data))
	}

	onMessage(data) {
		const raw = String(data)
		let env = null
		try {
			const parsed = JSON.parse(raw)
			if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && "body" in parsed) env = parsed
		} catch {
			this.protocolErrors += 1 // non-JSON frame - counted and surfaced at the end.
		}
		this.frames.push({ raw, env })
	}

	send(bodyObj) {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) throw new Error(`${this.name}: socket not open`)
		// Send-side envelope shape per connectors/web/backend/ws/web-ws-server.ts L96-101.
		const envelope = { protocolVersion: PROTOCOL_VERSION, sentAt: Date.now(), body: bodyObj }
		this.ws.send(JSON.stringify(envelope))
	}

	async consumeNext(predicate, timeoutMs, pollMs = 25) {
		const deadline = Date.now() + timeoutMs
		for (;;) {
			for (let i = this.cursor; i < this.frames.length; i += 1) {
				if (predicate(this.frames[i])) {
					this.cursor = i + 1
					return this.frames[i]
				}
			}
			if (Date.now() > deadline) return null
			await sleep(pollMs)
		}
	}

	scan(predicate) {
		// Full-history scan for post-hoc assertions (e.g. client B silence in C4).
		return this.frames.filter(f => f.env !== null && predicate(f))
	}

	close() {
		try { this.ws?.close() } catch { /* already closed - nothing to do */ }
	}
}

export async function handshake(client) {
	client.send({ type: "hello", clientKind: "browser" }) // hello frame per connectors/web/backend/smoke.test.ts L73-89.
	const found = await client.consumeNext(f => f.env !== null && typeof f.env.clientId === "string", 20_000)
	if (!found || !found.env?.clientId) {
		console.warn(`[icg-c2] WARN ${client.name}: no clientId echo after hello - continuing (targeting is server-side)` )
		return null
	}
	client.clientId = found.env.clientId
	return client.clientId
}

export async function waitArchiveReady(client) {
	const deadline = Date.now() + READY_TIMEOUT_MS
	let lastPrintAt = 0
	while (Date.now() < deadline) {
		// Probe with the unique first-message marker until search returns hits for this task.
		client.send({ type: T.searchRequested, taskId: TASK_ID, query: markerFor(1) })
		const resp = await client.consumeNext(f => f.env?.body?.type === T.searchResponse, 5_000)
		if (resp && extractNodeIds(resp.raw).some(id => id.startsWith(`msg:${TASK_ID}:`))) {
			console.log("[icg-c2] archive ready: first-marker search returned hits")
			return
		}
		const now = Date.now()
		if (now - lastPrintAt >= 30_000) {
			lastPrintAt = now
			const secs = Math.round((now - (deadline - READY_TIMEOUT_MS)) / 1000)
			console.log(`[icg-c2] waiting for archive reconciliation... ${secs}s elapsed`)
		}
		await sleep(5_000)
	}
	const hint = "check boot-time reconciliation of <data-dir>/tasks/<id>/api_conversation_history.json; see server.log"
	throw new Error(`archive not ready within ${READY_TIMEOUT_MS / 1000}s - ${hint}` )
}

function firstNodeIdOf(resp) {
	// results is flat on the frame body (handleSearchRequest, backend/features/context/actions/index.ts).
	const results = resp.env.body.results
	if (!Array.isArray(results)) return extractNodeIds(resp.raw).find(id => id.startsWith(`msg:${TASK_ID}:`)) ?? null
	return typeof results[0]?.nodeId === "string" ? results[0].nodeId : undefined // layout-independent fallback above.
}

export async function discoverSeq(client, marker) {
	client.send({ type: T.searchRequested, taskId: TASK_ID, query: marker })
	const resp = await client.consumeNext(f => f.env?.body?.type === T.searchResponse, 10_000)
	if (!resp) throw new Error(`no search response for ${marker}` )
	// msg:<taskId>:<seq> addressing - the locator format used by recall [D-recall-locators-required].
	const nodeId = firstNodeIdOf(resp)
	const match = typeof nodeId === "string" ? /^msg:([^:]+):(\d+)$/.exec(nodeId) : null
	if (!match || match[1] !== TASK_ID) throw new Error(`seq unresolved for ${marker}: node=${String(nodeId)} ` )
	return Number(match[2])
}

export const results = [] // { id, ok, detail } rows - printed as the summary table at the end.
export function record(id, ok, detail) {
	results.push({ id, ok, detail })
	console.log(`${ok ? "PASS" : "FAIL"} ${id}: ${detail}` )
}

export async function killChild(child) {
	// Explicit PID kill - never a bare pkill. SIGTERM first with a 5s grace window, then SIGKILL if still alive.
	if (!child || child.exitCode !== null) return
	child.kill("SIGTERM")
	await new Promise(resolve => {
		const timer = setTimeout(() => resolve(), 5_000)
		child.once("exit", () => {
			clearTimeout(timer)
			resolve()
		})
	})
	if (child.exitCode === null) child.kill("SIGKILL") // still alive after the SIGTERM grace window.
}
