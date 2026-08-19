import { isRecord } from "@/lib/utils/validation/guards.js"

import type { JsonEventEmitter } from "@/agent/json/index.js"
import { parseQueueSnapshot, areStringArraysEqual } from "./helpers.js"

interface QueueContextRef {
	hasSeenQueueState: boolean
	lastQueueDepth: number
	lastQueueMessageIds: string[]
	pendingQueuedMessageRequestIds: string[]
	queueMessageRequestIdByMessageId: Map<string, string>
}

function handleExitedStatus(parsed: Record<string, unknown>, jsonEmitter: JsonEventEmitter): void {
	const exitCode = typeof parsed.exitCode === "number" ? parsed.exitCode : undefined
	if (typeof parsed.output === "string") jsonEmitter.emitCommandOutputChunk(parsed.output)
	jsonEmitter.markCommandOutputExited(exitCode)
}

function handleTerminalStatus(parsed: Record<string, unknown>, jsonEmitter: JsonEventEmitter): void {
	if (parsed.status === "output" && typeof parsed.output === "string") {
		jsonEmitter.emitCommandOutputChunk(parsed.output)
		return
	}
	if (parsed.status === "exited") {
		handleExitedStatus(parsed, jsonEmitter)
		return
	}
	if (parsed.status === "timeout" || parsed.status === "fallback") {
		jsonEmitter.emitCommandOutputDone(undefined)
		return
	}
}

export function handleCommandExecutionStatus(message: { text?: unknown }, jsonEmitter: JsonEventEmitter): boolean {
	if (typeof message.text !== "string") return false
	let parsedStatus: unknown
	try {
		parsedStatus = JSON.parse(message.text)
	} catch {
		return false
	}
	if (!isRecord(parsedStatus) || typeof parsedStatus.status !== "string") return false
	handleTerminalStatus(parsedStatus, jsonEmitter)
	return true
}

function assignRequestIdsToNewQueueMessages(
	queueMessageIds: string[],
	pending: string[],
	byMessageId: Map<string, string>,
): void {
	for (const messageId of queueMessageIds) {
		if (byMessageId.has(messageId)) continue
		const requestId = pending.shift()
		if (!requestId) continue
		byMessageId.set(messageId, requestId)
	}
}

function promoteRequestIdForDequeuedMessages(
	queueMessageIds: string[],
	lastQueueMessageIds: string[],
	byMessageId: Map<string, string>,
	setStreamRequestId: (id: string | undefined) => void,
): void {
	if (lastQueueMessageIds.length === 0) return
	const remainingIds = new Set(queueMessageIds)
	for (const dequeuedMessageId of lastQueueMessageIds) {
		if (remainingIds.has(dequeuedMessageId)) continue
		const requestId = byMessageId.get(dequeuedMessageId)
		if (requestId) setStreamRequestId(requestId)
		byMessageId.delete(dequeuedMessageId)
	}
}

function computeQueueSubtype(
	queueDepth: number,
	lastQueueDepth: number,
): "enqueued" | "dequeued" | "drained" | "updated" {
	if (queueDepth <= lastQueueDepth) return queueDepth === 0 ? "drained" : "dequeued"
	return "enqueued"
}

function handleInitialQueueSnapshot(
	queueSnapshot: ReturnType<typeof parseQueueSnapshot>,
	jsonEmitter: JsonEventEmitter,
	latestTaskIdRef: { current: string | undefined },
	ctx: QueueContextRef,
): void {
	if (!queueSnapshot) return
	const queueDepth = queueSnapshot.length
	const queueMessageIds = queueSnapshot.map((item) => item.id)
	assignRequestIdsToNewQueueMessages(
		queueMessageIds,
		ctx.pendingQueuedMessageRequestIds,
		ctx.queueMessageRequestIdByMessageId,
	)
	ctx.hasSeenQueueState = true
	ctx.lastQueueDepth = queueDepth
	ctx.lastQueueMessageIds = queueMessageIds
	if (queueDepth === 0) return
	jsonEmitter.emitQueue({
		subtype: "snapshot",
		taskId: latestTaskIdRef.current,
		content: `queue snapshot (${queueDepth} item${queueDepth === 1 ? "" : "s"})`,
		queueDepth,
		queue: queueSnapshot,
	})
}

function handleQueueUpdate(
	queueSnapshot: ReturnType<typeof parseQueueSnapshot>,
	jsonEmitter: JsonEventEmitter,
	latestTaskIdRef: { current: string | undefined },
	ctx: QueueContextRef,
	setStreamRequestId: (id: string | undefined) => void,
): void {
	if (!queueSnapshot) return
	const queueDepth = queueSnapshot.length
	const queueMessageIds = queueSnapshot.map((item) => item.id)
	const depthChanged = queueDepth !== ctx.lastQueueDepth
	const idsChanged = !areStringArraysEqual(queueMessageIds, ctx.lastQueueMessageIds)
	if (!depthChanged && !idsChanged) return
	promoteRequestIdForDequeuedMessages(
		queueMessageIds,
		ctx.lastQueueMessageIds,
		ctx.queueMessageRequestIdByMessageId,
		setStreamRequestId,
	)
	assignRequestIdsToNewQueueMessages(
		queueMessageIds,
		ctx.pendingQueuedMessageRequestIds,
		ctx.queueMessageRequestIdByMessageId,
	)
	const subtype = depthChanged ? computeQueueSubtype(queueDepth, ctx.lastQueueDepth) : "updated"
	const content =
		subtype === "drained" ? "queue drained" : `queue ${subtype} (${queueDepth} item${queueDepth === 1 ? "" : "s"})`
	jsonEmitter.emitQueue({ subtype, taskId: latestTaskIdRef.current, content, queueDepth, queue: queueSnapshot })
	ctx.lastQueueDepth = queueDepth
	ctx.lastQueueMessageIds = queueMessageIds
}

function handleUpdateLatestTaskId(
	messageState: { currentTaskId?: unknown; currentTaskItem?: { id?: unknown }; messageQueue?: unknown },
	latestTaskIdRef: { current: string | undefined },
): void {
	const currentTaskId = messageState.currentTaskId ?? messageState.currentTaskItem?.id
	if (typeof currentTaskId === "string" && currentTaskId.trim().length > 0) latestTaskIdRef.current = currentTaskId
}

function handleQueueSnapshot(
	messageState: { currentTaskId?: unknown; currentTaskItem?: { id?: unknown }; messageQueue?: unknown } | undefined,
	jsonEmitter: JsonEventEmitter,
	latestTaskIdRef: { current: string | undefined },
	ctx: QueueContextRef,
	setStreamRequestId: (id: string | undefined) => void,
): void {
	if (!messageState) return
	handleUpdateLatestTaskId(messageState, latestTaskIdRef)
	const queueSnapshot = parseQueueSnapshot(messageState.messageQueue)
	if (!queueSnapshot) return
	if (!ctx.hasSeenQueueState) {
		handleInitialQueueSnapshot(queueSnapshot, jsonEmitter, latestTaskIdRef, ctx)
		return
	}
	handleQueueUpdate(queueSnapshot, jsonEmitter, latestTaskIdRef, ctx, setStreamRequestId)
}

export interface MessageHandlerDeps {
	jsonEmitter: JsonEventEmitter
	setStreamRequestId: (id: string | undefined) => void
	latestTaskIdRef: { current: string | undefined }
	hasSeenQueueState: boolean
	lastQueueDepth: number
	lastQueueMessageIds: string[]
	pendingQueuedMessageRequestIds: string[]
	queueMessageRequestIdByMessageId: Map<string, string>
}

export function createExtensionMessageHandler(
	deps: MessageHandlerDeps,
): (message: {
	type?: string
	text?: unknown
	state?: { currentTaskId?: unknown; currentTaskItem?: { id?: unknown }; messageQueue?: unknown }
}) => void {
	const { jsonEmitter, setStreamRequestId, latestTaskIdRef } = deps
	const ctx: QueueContextRef = {
		hasSeenQueueState: deps.hasSeenQueueState,
		lastQueueDepth: deps.lastQueueDepth,
		lastQueueMessageIds: deps.lastQueueMessageIds,
		pendingQueuedMessageRequestIds: deps.pendingQueuedMessageRequestIds,
		queueMessageRequestIdByMessageId: deps.queueMessageRequestIdByMessageId,
	}
	return (message) => {
		if (message.type === "commandExecutionStatus") {
			handleCommandExecutionStatus(message, jsonEmitter)
			return
		}
		if (message.type !== "state") return
		handleQueueSnapshot(message.state, jsonEmitter, latestTaskIdRef, ctx, setStreamRequestId)
	}
}
