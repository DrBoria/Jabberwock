/**
 * C3 GATE - command surface over WebSocket (plan section 10.2 L834 + section 11 row C3).
 *
 * Proves, end-to-end against a real WebWsServer transport:
 *   1. `newTask` accepted as an ordinary webview message body over WS produces
 *      streamChunk frames plus task-event state frames on the same channel;
 *   2. mid-stream `cancelTask` stops the chunk stream and is processed through
 *      the Critical priority bucket (IntentPriority.Critical = 0);
 *   3. section 5.1 cooperative preemption verified in IntentStore snapshots: a Low-priority
 *      fiber that yields while a Critical intent is pending is observed Suspended inside
 *      an IntentStore snapshot captured during the suspension window.
 *
 * Boot sequence lives in ./c3-gate-boot.ts (hermetic server bootstrap + shared helpers).
 */

import { rmSync } from "node:fs"
import { randomUUID } from "node:crypto"
import { reaction } from "mobx"
import { getSnapshot } from "mobx-state-tree"
import { WebSocket } from "ws"
import { PROTOCOL_VERSION, IntentStatus } from "@jabberwock/types"

import { bootGateEnvironment, sleep, waitFor, asRecord, readStreamChunks } from "./c3-gate-boot"
import type { GateBootResult } from "./c3-gate-boot"
import { IntentPriority } from "@features/intents/IntentConstants"

// -- Module state (single boot shared by both tests in this file) ------------------

let env: GateBootResult | undefined
const receivedBodies: Array<Record<string, unknown>> = []

function store() {
	if (!env) throw new Error("C3 gate test: environment not booted")
	return env.rootStore
}

function sendFrame(body: Record<string, unknown>): void {
	const client = env?.wsClient
	if (!client || client.readyState !== WebSocket.OPEN) throw new Error("C3 gate test: WS client is not open")
	// Section 4.1 transport envelope: protocolVersion + sentAt + body.
	client.send(JSON.stringify({ protocolVersion: PROTOCOL_VERSION, sentAt: Date.now(), body }))
}

/** Find the first state frame carrying a currentTaskItem after startIdx. */
function findTaskEventState(startIdx: number): Record<string, unknown> | undefined {
	for (const body of receivedBodies.slice(startIdx)) {
		if (body.type !== "state") continue
		const state = asRecord(body.state)
		if (!state || !asRecord(state.currentTaskItem)) continue
		return state
	}
	return undefined
}

/** Snapshot of the intent store (concrete type via a non-generic accessor). */
function intentStoreSnapshot() {
	return getSnapshot(store().intentStore)
}
type IntentStoreSnap = ReturnType<typeof intentStoreSnapshot>

/** Find the cancel intent that reached Success status in the IntentStore snapshot. */
function findCancelIntent() {
	const snap = intentStoreSnapshot()
	return snap.intents.find((i) => i.type === "task.cancel.requested" && i.status === IntentStatus.Success)
}

/** Probe: both the probe fiber and the cancel intent reached Success, and the capture fired. */
function bothIntentsSettled(
	captureFiredAt: number,
	probeResumedAt: number,
	probeIntentId: string,
	pendingCancelId: string,
): boolean | undefined {
	const snap = getSnapshot(store().intentStore)
	const probeOk = snap.intents.find((i) => i.id === probeIntentId)?.status === IntentStatus.Success
	const cancelOk = snap.intents.find((i) => i.id === pendingCancelId)?.status === IntentStatus.Success
	return captureFiredAt > 0 && probeResumedAt > 0 && probeOk && cancelOk ? true : undefined
}

// -- Boot / teardown ---------------------------------------------------------------

beforeAll(async () => {
	env = await bootGateEnvironment(receivedBodies)

	// section 6.2 handshake: hello -> state frame with _hydration flag and the getState() payload.
	sendFrame({ type: "hello", clientKind: "gate-test" })
	await waitFor(
		() => {
			for (const body of receivedBodies) if (body.type === "state") return body
			return undefined
		},
		5_000,
		"handshake state frame",
	)
	const handshakeState = asRecord(receivedBodies.find((b2) => b2.type === "state")?.state)
	if (!handshakeState || !asRecord(handshakeState)) throw new Error("C3 gate test: malformed handshake state frame")
	expect(asRecord(handshakeState)?.gateTestHandshake).toBe(true)
})

afterAll(async () => {
	env?.wsClient.close()
	await env?.connector.stop()
	const server = env?.httpServer
	if (server) {
		server.closeAllConnections()
		await new Promise<void>((resolve) => server.close(() => resolve()))
	}
	if (env) rmSync(env.tmpDir, { recursive: true, force: true })
})

// -- Test 1 - E2E command surface over WS (spec gate scope) ------------------------

it("newTask over WS yields streamChunk frames + task events; mid-stream cancel stops the stream via Critical bucket", async () => {
	const startIdx = receivedBodies.length

	// Ordinary webview message body carried in a section 4.1 envelope - no special command channel exists.
	sendFrame({ type: "newTask", text: "gate prompt" })

	const taskEvent = await waitFor(
		() => findTaskEventState(startIdx),
		10_000,
		"task-event state frame with currentTaskItem",
	)
	expect(taskEvent.isRunning).toBe(true)

	let eventItemId = ""
	const currentItemRecord = asRecord(taskEvent.currentTaskItem)
	if (currentItemRecord && typeof currentItemRecord.id === "string") eventItemId = currentItemRecord.id

	await waitFor(
		() => {
			const chunks = readStreamChunks(receivedBodies.slice(startIdx))
			return chunks.length >= 3 ? chunks : undefined
		},
		10_000,
		">=3 streamChunk frames",
	)

	if (!eventItemId || readStreamChunks(receivedBodies.slice(startIdx)).length === 0) {
		throw new Error("C3 gate test: missing event item id or no chunks before cancel")
	}
	const chunksAtCancelSend = readStreamChunks(receivedBodies.slice(startIdx))
	expect(chunksAtCancelSend.every((c) => c.taskId.length > 0 && c.taskId === eventItemId)).toBe(true)

	// Mid-stream cancel over WS. The webview handler applies direct effects immediately and creates a
	// task.cancel.requested intent with IntentPriority.Critical; the SSE loop checks abort state between chunks.
	sendFrame({ type: "cancelTask" })

	await waitFor(() => (!store().chat.isRunning ? true : undefined), 5_000, "isRunning false after cancel")

	// Silence window 1 (700ms): at most a few in-flight frames may still land after the abort.
	await sleep(700)
	const countAfterFirstWindow = readStreamChunks(receivedBodies.slice(startIdx)).length
	expect(countAfterFirstWindow - chunksAtCancelSend.length).toBeLessThanOrEqual(3)

	// Silence window 2 (400ms): strict equality proves a hard stop, not just slowdown.
	await sleep(400)
	const countAfterSecondWindow = readStreamChunks(receivedBodies.slice(startIdx)).length
	expect(countAfterSecondWindow).toBe(countAfterFirstWindow)

	// Critical bucket evidence at E2E level: task.cancel.requested processed with priority 0 and Success status.
	const cancelIntent = await waitFor(() => findCancelIntent(), 5_000, "cancel intent reaching Success status")
	expect(cancelIntent.priority).toBe(IntentPriority.Critical)
})

// -- Test 2 - section 5.1 preemption verified in IntentStore snapshots -------------

it("a Low-priority fiber yielding while a Critical intent is pending is observed Suspended in an IntentStore snapshot", async () => {
	const bus = env?.bus
	if (!bus) throw new Error("C3 gate test: intent bus not booted")

	let pendingCancelId = ""
	let captureFiredAt = -1
	let probeResumedAt = -1
	const capturedSnapshots: Array<IntentStoreSnap> = []
	const probeIntentId = randomUUID()

	// Probe fiber on "log.write" (Low priority; no production handler registered for it).
	bus.register("log.write", async (_intent, ctx) => {
		if (!ctx.scheduler) throw new Error("C3 gate test: intent context has no scheduler")
		while (!(pendingCancelId && store().intentStore.intents.some((i) => i.id === pendingCancelId))) await sleep(10)
		await ctx.scheduler.yield()
		probeResumedAt = Date.now()
	})

	// Deterministic capture: MobX reactions fire synchronously on the Suspended mutation,
	// so this observer captures an IntentStore snapshot with probe=Suspended at preemption time.
	const suspendObserver = reaction(
		() => store().intentStore.intents.some((i) => i.id === probeIntentId && i.status === IntentStatus.Suspended),
		(suspendedNow) => {
			if (suspendedNow) {
				capturedSnapshots.push(getSnapshot(store().intentStore))
				captureFiredAt = Date.now()
			}
		},
	)

	store().intentStore.createIntent({
		id: probeIntentId,
		type: "log.write",
		payload: { taskId: "", message: "gate probe fiber", level: "info" },
		status: IntentStatus.Queued,
		createdAt: Date.now(),
	})

	await sleep(80)

	pendingCancelId = randomUUID()
	store().intentStore.createIntent({
		id: pendingCancelId,
		type: "task.cancel.requested",
		payload: { taskId: "" },
		priority: IntentPriority.Critical,
		status: IntentStatus.Queued,
		createdAt: Date.now(),
	})

	try {
		await waitFor(
			() => bothIntentsSettled(captureFiredAt, probeResumedAt, probeIntentId, pendingCancelId),
			8_000,
			"suspension captured + both intents Success",
		)

		expect(capturedSnapshots.length).toBeGreaterThanOrEqual(1)
		const snapAtCapture = capturedSnapshots[0]
		if (!snapAtCapture) throw new Error("C3 gate test: no snapshot was captured during the suspension window")

		// THE spec assertion - preemption visible in an IntentStore snapshot: while Critical work is pending,
		// the yielding Low-priority fiber is Suspended.
		const probeInSnap = snapAtCapture.intents.find((i) => i.id === probeIntentId)
		expect(probeInSnap?.status).toBe(IntentStatus.Suspended)

		const cancelInSnap = snapAtCapture.intents.find((i) => i.id === pendingCancelId)
		expect(cancelInSnap?.priority).toBe(IntentPriority.Critical)
		expect(cancelInSnap?.status !== IntentStatus.Failed).toBe(true)

		// Ordering proof: the probe resumed no earlier than its own suspension was captured.
		expect(probeResumedAt >= captureFiredAt && probeResumedAt > 0).toBe(true)
	} finally {
		suspendObserver()
	}
})
