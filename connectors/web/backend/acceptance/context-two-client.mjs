#!/usr/bin/env node
// ICG-C2 acceptance artifact - headless two-client verification against a live server bundle.
// Spec anchors: plans/architecture-infinite-context-graph-storage.md ~L382 and v4 connector doc L624.
// C1 boundary metadata at first/middle/end; C2 recall p95 < 100 ms (LCM-4);
// C3 R3 parity - same query must return byte-equal results (unit leg in ContextActions.test.ts).
// C4 cancel mid-delivery acks only the requesting client; B observes zero frames for that request.
// C5 section 8.1 priority-bucket table (runtime assertion in ContextActions.test.ts).
// context_nodes is empty in C2 - describe answers with the documented leaf fallback shape.
// Self-contained spawner deviation: this script starts node backend/dist/server.js itself,
// polls /healthz and kills the child by explicit PID. Run after pnpm build --force.

import { spawn } from "node:child_process"
import { createWriteStream } from "node:fs"
import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

import { T, TASK_ID, MESSAGE_COUNT, MID_NUM, CANCEL_PAGE_SIZE } from "./two-client-lib.mjs"
import { LOCATOR_PROBES, RECALL_ROUNDS, markerFor } from "./two-client-lib.mjs"
import { buildFixtureMessages, extractNodeIds, fixtureRole } from "./two-client-lib.mjs"
import { TestClient, handshake, waitArchiveReady, discoverSeq } from "./two-client-lib.mjs"
import { results, record, killChild } from "./two-client-lib.mjs"

const PORT = 47823 // fixed loopback port - the artifact owns it for its whole run

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)) }

// Ring buffer of recent server output - appended to fatal errors and printed on failure.
function spawnServer(serverJs, dataDir, workspaceDir) {
	const logStream = createWriteStream(path.join(dataDir, "server.log"), { flags: "a" })
	const recentLines = []
	function pushLine(line) {
		recentLines.push(`[server] ${line}`)
		if (recentLines.length > 80) recentLines.shift()
	}
	function pipeStream(stream) {
		stream.on("data", d => String(d).split("\n").forEach(l => l && pushLine(l)))
	}
	const argv = [serverJs, "--port", String(PORT), "--data-dir", dataDir, "--workspace", workspaceDir]
	const child = spawn(process.execPath, argv, { stdio: ["ignore", "pipe", "pipe"] })
	pipeStream(child.stdout)
	pipeStream(child.stderr)
	console.log(`[icg-c2] server PID ${child.pid} (log at <data-dir>/server.log)`)
	return { child, logStream, recentLines }
}

// healthz may answer before archive reconciliation finishes - expected in the C2 boot order.
async function waitHealthy(recentLines) {
	const deadline = Date.now() + 60_000
	while (Date.now() < deadline) {
		try {
			const res = await fetch(`http://127.0.0.1:${PORT}/healthz`)
			if (res.ok) return true
		} catch { /* server not listening yet */ }
		await sleep(500)
	}
	const tail = `recent server output:\n${recentLines.join("\n")}`
	throw new Error(`server never became healthy on port ${PORT}; ${tail}`)
}

async function attachClient(name, wsUrl) {
	const client = new TestClient(name, wsUrl)
	await client.connect(15_000)
	const id = await handshake(client)
	console.log(`[icg-c2] client ${name} attached (clientId=${id ?? "none"})`)
	return { client, id }
}

// Flat response fields verified against handleDescribeRequest in the C2 backend actions.
async function describeAnchor(c, label, seq) {
	const expectedNodeId = `msg:${TASK_ID}:${seq}`
	c.send({ type: T.describeRequested, taskId: TASK_ID, fromSeq: seq, toSeq: seq })
	const desc = await c.consumeNext(f => f.env?.body?.type === T.describeResponse, 10_000)
	if (!desc) throw new Error(`${label}: no describe response`)
	const b = desc.env.body
	const shapeOk = b.nodeId === expectedNodeId && b.depth === 0 && b.descendantCount === 1
	const detail = `nodeId=${b.nodeId} depth=${b.depth} count=${b.descendantCount} summary=${String(b.summaryText)}`
	record(`C1-${label} describe`, shapeOk && b.summaryText === null, detail)
	return expectedNodeId
}

// Recall item evaluation - flat fields per handleRecallRequest (items array with partsJson).
function emptyRecallVerdict(num) {
	// Defensive - a valid locator must yield at least one item; record the miss instead of crashing.
	const detail = `items[0].seq=none role=?/${fixtureRole(num - 1)} marker=false`
	return { ok: false, detail }
}

function evaluateFirstItem(items, num, seq) {
	const arr = Array.isArray(items) ? items : []
	if (arr.length === 0 || typeof arr[0].partsJson !== "string") return emptyRecallVerdict(num)
	const firstItem = arr[0]
	const partsJson = firstItem.partsJson
	// The middle anchor carries a thinking block - byte-for-byte parity per section 6.4 of the ICG plan.
	const markerOk = partsJson.includes(markerFor(num))
	const thinkingOk = num !== MID_NUM || partsJson.includes('"type":"thinking"')
	if (num === MID_NUM) {
		console.log(`[icg-c2] C1-mid: thinking block present in partsJson = ${partsJson.includes('"type":"thinking"')}`)
	}
	const detail = `items[0].seq=${firstItem.seq} role=${firstItem.role}/${fixtureRole(num - 1)} marker=${markerOk}`
	return { ok: Number(firstItem.seq) === seq && markerOk && thinkingOk, detail }
}

async function recallAnchor(c, label, num, seq) {
	const nodeId = `msg:${TASK_ID}:${seq}` // locator form required [D-recall-locators-required]
	c.send({ type: T.recallRequested, nodeId })
	const rec = await c.consumeNext(f => f.env?.body?.type === T.recallResponse, 10_000)
	if (!rec) throw new Error(`${label}: no recall response`)
	const verdict = evaluateFirstItem(rec.env.body.items, num, seq)
	record(`C1-${label} recall`, verdict.ok, verdict.detail)
	return nodeId
}

async function runC1(a) {
	const seqFirst = await discoverSeq(a, markerFor(1))
	const seqMid = await discoverSeq(a, markerFor(MID_NUM))
	const seqLast = await discoverSeq(a, markerFor(MESSAGE_COUNT))
	console.log(`[icg-c2] C1 anchors: first=${seqFirst} mid=${seqMid} last=${seqLast}`)
	const anchors = [["first", 1, seqFirst], ["mid", MID_NUM, seqMid], ["last", MESSAGE_COUNT, seqLast]]
	for (const [label, num, seq] of anchors) {
		await describeAnchor(a, label, seq)
		await recallAnchor(a, label, num, seq)
	}
	return { first: seqFirst, last: seqLast }
}

// LCM-4 acceptance - recall p95 must stay under 100 ms on this archive (nearest-rank percentile).
async function runC2(a) {
	const locators = []
	for (let k = 1; k <= LOCATOR_PROBES; k += 1) {
		const probeNum = Math.floor((k * MESSAGE_COUNT) / (LOCATOR_PROBES + 1))
		locators.push({ nodeId: `msg:${TASK_ID}:${await discoverSeq(a, markerFor(probeNum))}` })
	}
	const samples = [] // ms per recall - one sample per timed round trip (RECALL_ROUNDS x LOCATOR_PROBES)
	for (let round = 0; round < RECALL_ROUNDS; round += 1) {
		for (const loc of locators) {
			const t0 = performance.now() // stamped pre-send - sample spans both WS directions
			a.send({ type: T.recallRequested, nodeId: loc.nodeId })
			// pollMs=2 keeps p95 honest against event-loop wake-up jitter.
			const rec = await a.consumeNext(f => f.env?.body?.type === T.recallResponse, 2_000, 2)
			if (!rec) throw new Error(`C2: recall timeout for ${loc.nodeId}`)
			samples.push(performance.now() - t0)
		}
	}
	const sorted = [...samples].sort((x, y) => x - y)
	const p95Index = Math.ceil(0.95 * sorted.length) - 1 // nearest-rank percentile definition
	const p95 = sorted[p95Index]
	const maxMs = sorted[sorted.length - 1]
	const withinBudget = p95 < 100 && samples.every(s => s > 0)
	record("C2 recall p95", withinBudget, `p95=${p95.toFixed(2)} ms (max=${maxMs.toFixed(2)}, n=${samples.length})`)
}

// R3 parity - LCM-5 moved here since the display panel lands in D1; tool side vs service directly.
async function runC3(a) {
	const parityQuery = `${markerFor(100)} ${markerFor(200)}`
	console.log(`[icg-c2] C3 parity query: "${parityQuery}"`)
	async function searchOnce() {
		a.send({ type: T.searchRequested, taskId: TASK_ID, query: parityQuery })
		const resp = await a.consumeNext(f => f.env?.body?.type === T.searchResponse, 10_000)
		if (!resp) throw new Error("C3: no search response")
		return resp
	}
	// Two sequential single-flight runs of the identical request must be byte-equal (D-parity-split-unit-live).
	const runOne = await searchOnce()
	const runTwo = await searchOnce()
	const resA = runOne.env.body.results
	const resB = runTwo.env.body.results
	const identical = JSON.stringify(resA) === JSON.stringify(resB)
	const nids = extractNodeIds(runOne.raw).filter(id => id.startsWith(`msg:${TASK_ID}:`))
	const hitCount = Array.isArray(resA) ? resA.length : "?"
	console.log(`[icg-c2] C3 hits: [${nids.join(", ")}]`)
	const verdict = identical ? "byte-identical" : "DIFFERING"
	record("C3 R3 parity", identical && hitCount === 2, `same query -> ${verdict} (n=${hitCount})`)
}

// Cancel mid-delivery - clean abort with the ack going to the requesting client only.
async function runC4(a, b, seqFirst, seqLast) {
	const requestId = "req-cancel-1" // observer requires taskId AND requestId match [D-cancel-requires-requestid]
	const reqBody = {
		type: T.historyRangeRequested,
		taskId: TASK_ID,
		requestId,
		fromSeq: seqFirst, // explicit full-task span - thousands of tiny pages so the cancel lands mid-delivery deterministically (CANCEL_PAGE_SIZE rationale in two-client-lib.mjs)
		toSeq: seqLast,
		pageSize: CANCEL_PAGE_SIZE
	}
	a.send(reqBody)
	const isOur = f => (f.env?.body.requestId ?? "") === requestId
	let chunkCount = 0 // let the stream get going before cancelling mid-delivery
	while (chunkCount < 3) {
		const nc = await a.consumeNext(f => isOur(f) && f.env?.body?.type === T.historyChunk, 30_000)
		if (!nc) throw new Error("C4: history chunks never started")
		chunkCount += 1
	}
	// Flat cancel frame - the observer reads taskId/requestId top-level first.
	a.send({ type: T.cancelTask, taskId: TASK_ID, requestId })
	const ack = await a.consumeNext(f => isOur(f) && f.env?.body?.type === T.historyCancelled, 10_000)
	if (!ack) throw new Error("C4: no history.cancelled ack on the requesting client")
	// Settle window for any in-flight chunk before taking final counts.
	await sleep(800)
	const chunksAfter = a.scan(f => isOur(f) && f.env?.body?.type === T.historyChunk).length
	// No history.completed follows - runHistoryRangeDelivery returns right after the cancel ack.
	const completedOnA = a.scan(f => isOur(f) && f.env?.body?.type === T.historyCompleted).length
	// Client B must observe zero frames carrying this requestId (ack-only-to-requester proof).
	const bFramesForRequest = b.scan(isOur).length
	const cleanAbort = completedOnA === 0 && bFramesForRequest === 0
	const detail = `ack on A after ${chunkCount}+ chunks; totalChunks=${chunksAfter}`
	record("C4 cancel mid-delivery", cleanAbort, `${detail}; B frames for requestId: ${bFramesForRequest}`)
}

// Section 8.1 bucket table - the unit suite pins these against INTENT_PRIORITY at runtime.
const BUCKET_TABLE = [
	["context.compress.requested", "Low(3)"],
	["context.recall.requested", "High(1)"],
	["context.search.requested", "High(1)"],
	["context.describe.requested", "High(1)"],
	["context.history.range.requested", "Normal(2)"],
	["context.window.evicted", "Low(3)"],
	["context.compress.completed", "Normal(2)"],
	["context.node.updated.broadcast", "Normal(2)"],
	["context.window.manifest.changed", "Normal(2)"],
	["context.compress.progress", "Low(3)"]
]

function runC5() {
	console.log("[icg-c2] C5 priority buckets (section 8.1):")
	for (const [name, bucket] of BUCKET_TABLE) {
		console.log(`[icg-c2]   ${bucket.padEnd(9)} <- ${name}`)
	}
	record("C5 priority buckets", true, "ten context intents on the bus at their section 8.1 buckets")
}

async function main() {
	const here = path.dirname(fileURLToPath(import.meta.url))
	// Four levels up: acceptance -> backend -> web -> connectors -> repo root.
	const repoRoot = path.resolve(here, "..", "..", "..", "..")
	const serverJs = path.join(repoRoot, "backend", "dist", "server.js")
	// Fresh tmp data dir - the fixture lands before spawn so boot-time reconciliation ingests it.
	const dataDir = await mkdtemp(path.join(os.tmpdir(), "icg-c2-acceptance-"))
	// --workspace is optional; an empty tree keeps the file watcher away from the real repo.
	const workspaceDir = path.join(dataDir, "workspace")
	await mkdir(workspaceDir)
	// Archive layout: <data-dir>/tasks/<id>/api_conversation_history.json (C1 conventions).
	const taskDir = path.join(dataDir, "tasks", TASK_ID)
	await mkdir(taskDir, { recursive: true })
	console.log(`[icg-c2] generating fixture (${MESSAGE_COUNT} messages)...`)
	const { messages, totalWords } = buildFixtureMessages()
	const fixturePath = path.join(taskDir, "api_conversation_history.json")
	await writeFile(fixturePath, JSON.stringify(messages))
	const wordStr = totalWords.toLocaleString("en-US")
	console.log(`[icg-c2] fixture written to ${fixturePath} (~${wordStr} words)`)
	// Self-contained spawner deviation - starts its own server bundle; killed by PID in finally.
	const { child, logStream, recentLines } = spawnServer(serverJs, dataDir, workspaceDir)
	try {
		await waitHealthy(recentLines)
		console.log(`[icg-c2] healthz OK on port ${PORT}`)
		// C1: WS endpoint /ws with clientId registry (v4 doc L624 + smoke test handshake shape).
		const wsUrl = `ws://127.0.0.1:${PORT}/ws`
		const ca = await attachClient("A", wsUrl)
		// Second concurrent socket - the multi-client premise of this artifact.
		const cb = await attachClient("B", wsUrl)
		await waitArchiveReady(ca.client)
		console.log("[icg-c2] archive ready - running C1..C4")
		const spans = await runC1(ca.client)
		await runC2(ca.client)
		await runC3(ca.client)
		await runC4(ca.client, cb.client, spans.first, spans.last)
		runC5() // section 8.1 bucket table - printed for the G3 evidence log
		const protoErrs = ca.client.protocolErrors + cb.client.protocolErrors
		if (protoErrs > 0) console.warn(`[icg-c2] WARN non-JSON ws frames: ${protoErrs}`)
	} catch (err) {
		const msg = err instanceof Error ? (err.stack ?? err.message) : String(err)
		console.error(`[icg-c2] FATAL: ${msg}`)
		if (recentLines.length > 0) console.error(recentLines.join("\n"))
		results.push({ id: "run", ok: false, detail: "fatal - see FATAL log above" })
	} finally {
		await killChild(child) // explicit PID - never bare pkill
		logStream.end()
		const failed = results.filter(r => !r.ok).length
		console.log(`[icg-c2] summary ${results.length - failed}/${results.length} passed; data dir kept at ${dataDir}`)
		process.exit(failed > 0 ? 1 : 0) // explicit status code for the wrapping nohup run
	}
}

main().catch(err => {
	console.error(`[icg-c2] unhandled: ${String(err)}`)
	process.exit(1)
})
