#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────────────
// v4 Phase D — D3 cross-compat smoke (artifact; run after `pnpm build --force`).
//
// Proves the interchangeability guarantee of the standalone server bundle (v4 §7.2):
// two WS clients (A + B) against `node backend/dist/server.js` behave identically at the
// wire level. Four categories, per plans/phase-d-implementation-plan.md D3:
//
//   C1 — Context-command identity: the same context.search/recall/describe request sent by
//        each client yields a byte-equal response body (ICG-C2 C3 parity, wire level).
//   C2 — Task-command wire-frame parity: a task-layer command (askResponse) issued by one
//        client produces an identical broadcast frame on BOTH clients — the backend is
//        client-agnostic; the transport is interchangeable (v4 §7.2 / success line 936).
//   C3 — First-response-wins (v4 §6.4): both clients answer the same ask (requestId). The
//        FIRST response is claimed; the late responder is acked `askResponseAck`
//        {status:"already-answered"} (targeted to it only) and the converged decision is
//        broadcast to all clients.
//   C4 — Broadcast convergence (v4 §6.3): every client observes the identical converged
//        `notification.ask.resolved` frame for the winning requestId (byte-equal bodies).
//
// Self-contained spawner deviation (same pattern as
// connectors/web/backend/acceptance/context-two-client.mjs): starts the server child itself
// on a fixed loopback port, polls /healthz, and kills the child by explicit PID. Node 20 has
// no global WebSocket, so `ws` is loaded from a workspace-local node_modules via createRequire.
// The archive is seeded with a tiny task so C1 is a non-trivial (non-empty) parity check.
// ─────────────────────────────────────────────────────────────────────────────────────

import { spawn } from "node:child_process"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, "..")
const localRequire = createRequire(import.meta.url)

function loadWebSocket() {
	const candidates = [
		path.join(REPO_ROOT, "backend/node_modules/ws"),
		path.join(REPO_ROOT, "connectors/web/node_modules/ws"),
		"ws",
	]
	for (const candidate of candidates) {
		try {
			return localRequire(candidate)
		} catch {
			/* try next */
		}
	}
	throw new Error("cross-compat-smoke: cannot resolve the `ws` package from any workspace node_modules")
}
const WebSocket = loadWebSocket()

// Protocol literals — keep in sync with packages/types/src/protocol and the events registry.
const PROTOCOL_VERSION = 1
const T = {
	searchRequested: "context.search.requested",
	recallRequested: "context.recall.requested",
	describeRequested: "context.describe.requested",
	searchResponse: "context.search.response",
	recallResponse: "context.recall.response",
	describeResponse: "context.describe.response",
	askResponse: "askResponse",
	askResolved: "notification.ask.resolved",
	askResponseAck: "askResponseAck",
}
const PORT = 47901 // fixed loopback port — the artifact owns it for the whole run
const TASK_ID = "task-smoke"
const MARKER = "SMOKEQ9"
const R_BROADCAST = "req-broadcast-1" // C2: single-responder ask (broadcast fan-out proof)
const R_RACE = "req-race-1" // C3/C4: two-responder first-response-wins ask

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

// ── Minimal WS test client (framing per connectors/web/backend/ws/web-ws-server.ts) ─────
class Client {
	constructor(name) {
		this.name = name
		this.ws = null
		this.frames = [] // { raw, env }
		this.cursor = 0
		this.clientId = null
	}

	async connect(url, timeoutMs) {
		this.ws = new WebSocket(url)
		await new Promise((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error(`${this.name}: ws open timeout`)), timeoutMs)
			this.ws.once("open", () => {
				clearTimeout(timer)
				resolve()
			})
			this.ws.once("error", (err) => {
				clearTimeout(timer)
				reject(err instanceof Error ? err : new Error(String(err)))
			})
		})
		this.ws.on("message", (data) => {
			const raw = String(data)
			let env = null
			try {
				const parsed = JSON.parse(raw)
				if (parsed && typeof parsed === "object" && "body" in parsed) env = parsed
			} catch {
				/* non-JSON frame */
			}
			this.frames.push({ raw, env })
		})
	}

	send(bodyObj) {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) throw new Error(`${this.name}: socket not open`)
		this.ws.send(JSON.stringify({ protocolVersion: PROTOCOL_VERSION, sentAt: Date.now(), body: bodyObj }))
	}

	// Wait from the cursor for the next frame matching predicate.
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

	// Full-history scan for post-hoc cross-client assertions.
	scan(predicate) {
		return this.frames.filter((f) => f.env !== null && predicate(f))
	}

	close() {
		try {
			this.ws?.close()
		} catch {
			/* already closed */
		}
	}
}

async function handshake(client) {
	// The server answers hello with a SINGLE state frame whose envelope carries the assigned
	// clientId (sendState in web-ws-server.ts) — read both from that one frame, do not wait for
	// a second handshake frame.
	client.send({ type: "hello", clientKind: "browser" })
	const stateFrame = await client.consumeNext(
		(f) => f.env !== null && f.env.body?.type === "state" && f.env.body?._hydration === true,
		20_000,
	)
	if (!stateFrame) throw new Error(`${client.name}: no hello->state frame`)
	client.clientId = typeof stateFrame.env?.clientId === "string" ? stateFrame.env.clientId : null
	return stateFrame
}

// ── Server lifecycle ─────────────────────────────────────────────────────────────────────
function seedArchive(dataDir) {
	// <dataDir>/tasks/<taskId>/api_conversation_history.json — the canonical ground-truth the
	// archive reconciles at boot (ContextArchiveService.reconcileTask). Two messages carry the
	// unique MARKER so a context.search for it returns non-empty hits.
	const messages = [
		{ id: "m1", role: "user", ts: 1, content: [{ type: "text", text: `${MARKER} hello archive` }] },
		{ id: "m2", role: "assistant", ts: 2, content: [{ type: "text", text: `${MARKER} archive response` }] },
		{ id: "m3", role: "user", ts: 3, content: [{ type: "text", text: "second message" }] },
		{ id: "m4", role: "assistant", ts: 4, content: [{ type: "text", text: "third message" }] },
		{ id: "m5", role: "user", ts: 5, content: [{ type: "text", text: "fourth message" }] },
	]
	return messages
}

async function startServer(dataDir, serverJs) {
	const argv = [serverJs, "--port", String(PORT), "--data-dir", dataDir, "--workspace", dataDir]
	const child = spawn(process.execPath, argv, { stdio: ["ignore", "inherit", "inherit"] })
	const deadline = Date.now() + 60_000
	while (Date.now() < deadline) {
		try {
			const res = await fetch(`http://127.0.0.1:${PORT}/healthz`)
			if (res.ok) return child
		} catch {
			/* not listening yet */
		}
		await sleep(400)
	}
	throw new Error("server never became healthy on /healthz")
}

async function stopChild(child) {
	if (!child || child.exitCode !== null) return
	child.kill("SIGTERM")
	await new Promise((resolve) => {
		const timer = setTimeout(resolve, 5_000)
		child.once("exit", () => {
			clearTimeout(timer)
			resolve()
		})
	})
	if (child.exitCode === null) child.kill("SIGKILL")
}

// ── Result table ─────────────────────────────────────────────────────────────────────────
const results = []
function record(id, ok, detail) {
	results.push({ id, ok, detail })
	console.log(`${ok ? "PASS" : "FAIL"}  ${id}  ${detail}`)
}
// Whole-envelope byte-equality — used for BROADCAST frames (one frame serialized once and
// fanned out to every socket, so both the sentAt and the body are identical).
function framesMatch(a, b) {
	return a !== null && b !== null && a.raw === b.raw
}
// Body-only byte-equality — used for TARGETED (per-client) context responses, whose envelopes
// legitimately differ by per-send `sentAt` (and clientId); the deterministic payload is the body.
function bodiesMatch(a, b) {
	if (a === null || b === null || !a.env?.body || !b.env?.body) return false
	return JSON.stringify(a.env.body) === JSON.stringify(b.env.body)
}

// ── Category 1: context-command identity (byte-equal bodies for the same query) ──────────
async function category1(a, b) {
	const sameQuery = (type) => (f) => f.env?.body?.type === type
	// Search — the seeded marker makes this a non-trivial, non-empty parity check.
	a.send({ type: T.searchRequested, taskId: TASK_ID, query: MARKER })
	const sA = await a.consumeNext(sameQuery(T.searchResponse), 15_000)
	b.send({ type: T.searchRequested, taskId: TASK_ID, query: MARKER })
	const sB = await b.consumeNext(sameQuery(T.searchResponse), 15_000)
	const searchNonEmpty = Array.isArray(sA?.env?.body?.results) && sA.env.body.results.length > 0
	record(
		"C1-search",
		bodiesMatch(sA, sB) && searchNonEmpty,
		`results=${searchNonEmpty ? sA.env.body.results.length : 0}; A===B body byte-equal=${bodiesMatch(sA, sB)}`,
	)
	// Recall — raw parts for a fixed node locator (nodeId addressing per the msg:<taskId>:<seq> scheme).
	const RECALL_NODE = `msg:${TASK_ID}:1`
	a.send({ type: T.recallRequested, nodeId: RECALL_NODE, fromSeq: 1, toSeq: 2 })
	const rA = await a.consumeNext(sameQuery(T.recallResponse), 15_000)
	b.send({ type: T.recallRequested, nodeId: RECALL_NODE, fromSeq: 1, toSeq: 2 })
	const rB = await b.consumeNext(sameQuery(T.recallResponse), 15_000)
	const recallNonEmpty = Array.isArray(rA?.env?.body?.items) && rA.env.body.items.length > 0
	record(
		"C1-recall",
		bodiesMatch(rA, rB) && recallNonEmpty,
		`items=${rA?.env?.body?.items?.length ?? 0}; A===B body byte-equal=${bodiesMatch(rA, rB)}`,
	)
	// Describe — drill-down metadata for a fixed range.
	a.send({ type: T.describeRequested, taskId: TASK_ID, fromSeq: 1, toSeq: 2 })
	const dA = await a.consumeNext(sameQuery(T.describeResponse), 15_000)
	b.send({ type: T.describeRequested, taskId: TASK_ID, fromSeq: 1, toSeq: 2 })
	const dB = await b.consumeNext(sameQuery(T.describeResponse), 15_000)
	record(
		"C1-describe",
		bodiesMatch(dA, dB),
		`nodeId=${dA?.env?.body?.nodeId ?? "?"}; A===B body byte-equal=${bodiesMatch(dA, dB)}`,
	)
}

// ── Category 2: task-command wire-frame parity (one command -> identical broadcast both) ──
async function category2(a, b) {
	a.send({ type: T.askResponse, requestId: R_BROADCAST, askResponse: "yesButtonClicked" })
	const onA = await a.consumeNext((f) => f.env?.body?.type === T.askResolved && f.env?.body?.requestId === R_BROADCAST, 15_000)
	const onB = b.scan((f) => f.env?.body?.type === T.askResolved && f.env?.body?.requestId === R_BROADCAST).at(0) ?? null
	record(
		"C2-task-parity",
		framesMatch(onA, onB) && onA?.env?.body?.askResponse === "yesButtonClicked",
		`single-responder ask broadcast; decision=${onA?.env?.body?.askResponse}; A===B byte-equal=${framesMatch(onA, onB)}`,
	)
}

// ── Category 3: first-response-wins (§6.4) + Category 4: broadcast convergence ────────────
async function category3and4(a, b) {
	// A answers first and its response is claimed (broadcast to all).
	a.send({ type: T.askResponse, requestId: R_RACE, askResponse: "yesButtonClicked" })
	const resolvedA = await a.consumeNext(
		(f) => f.env?.body?.type === T.askResolved && f.env?.body?.requestId === R_RACE,
		15_000,
	)
	const firstWins = resolvedA?.env?.body?.askResponse === "yesButtonClicked"
	// B answers the SAME ask late and differently — it must be acked, not acted on.
	b.send({ type: T.askResponse, requestId: R_RACE, askResponse: "noButtonClicked" })
	const ackB = await b.consumeNext(
		(f) => f.env?.body?.type === T.askResponseAck && f.env?.body?.requestId === R_RACE && f.env?.body?.status === "already-answered",
		15_000,
	)
	const lateAcked = ackB !== null
	// The late responder's duplicate must NOT produce a second resolved for R_RACE.
	await sleep(300)
	const resolvedCountB = b.scan((f) => f.env?.body?.type === T.askResolved && f.env?.body?.requestId === R_RACE).length
	const resolvedCountA = a.scan((f) => f.env?.body?.type === T.askResolved && f.env?.body?.requestId === R_RACE).length
	const noSecondResolved = resolvedCountA === 1 && resolvedCountB === 1
	// The targeted ack goes ONLY to the late responder (B), never to A.
	const ackLeakedToA = a.scan((f) => f.env?.body?.type === T.askResponseAck && f.env?.body?.requestId === R_RACE).length
	const targetedAck = ackLeakedToA === 0

	record("C3-first-response-wins", firstWins && lateAcked && noSecondResolved && targetedAck,
		`first(A=yes) claimed=${firstWins}; late(B=no) acked=${lateAcked}; one resolved each=${noSecondResolved} (A=${resolvedCountA},B=${resolvedCountB}); ack not leaked to A=${targetedAck}`)

	// C4: both clients observed the identical converged frame for the winning requestId.
	const convA = a.scan((f) => f.env?.body?.type === T.askResolved && f.env?.body?.requestId === R_RACE).at(0) ?? null
	const convB = b.scan((f) => f.env?.body?.type === T.askResolved && f.env?.body?.requestId === R_RACE).at(0) ?? null
	const converged = framesMatch(convA, convB) && convA?.env?.body?.askResponse === "yesButtonClicked"
	record(
		"C4-broadcast-convergence",
		converged,
		`both converged to decision=${convA?.env?.body?.askResponse ?? "?"}; A===B byte-equal=${converged}`,
	)
}

// ── Main ─────────────────────────────────────────────────────────────────────────────────
async function main() {
	const dataDir = await mkdtemp(path.join(os.tmpdir(), "jw-cross-compat-"))
	try {
		const taskDir = path.join(dataDir, "tasks", TASK_ID)
		await mkdir(taskDir, { recursive: true })
		await writeFile(path.join(taskDir, "api_conversation_history.json"), JSON.stringify(await seedArchive(dataDir), null, 2))

		const serverJs = path.join(REPO_ROOT, "backend/dist/server.js")
		console.log(`[cross-compat] starting server (data-dir=${dataDir})`)
		const child = await startServer(dataDir, serverJs)
		console.log(`[cross-compat] server healthy (pid ${child.pid})`)

		const url = `ws://127.0.0.1:${PORT}/ws`
		const a = new Client("A")
		const b = new Client("B")
		await a.connect(url, 15_000)
		await b.connect(url, 15_000)
		await handshake(a, url)
		await handshake(b, url)
		console.log(`[cross-compat] A=${a.clientId} B=${b.clientId} attached`)

		await category1(a, b)
		await category2(a, b)
		await category3and4(a, b)

		a.close()
		b.close()
		await stopChild(child)
	} finally {
		await rm(dataDir, { recursive: true, force: true })
	}

	const failures = results.filter((r) => !r.ok)
	console.log("\n──────── cross-compat summary ────────")
	for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.id}`)
	console.log(`──────── ${results.length - failures.length}/${results.length} passed ────────`)
	process.exit(failures.length === 0 ? 0 : 1)
}

main().catch((err) => {
	console.error("[cross-compat] FATAL:", err)
	process.exit(1)
})
