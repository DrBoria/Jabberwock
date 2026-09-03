// ICG-C2 section 8.1: context graph intent registration for the shared webview message pipeline (both hosts - registered from bootstrap's startBackend; see D-dual-mode-cancel-slot). Handlers are fire-and-forget by design: dispatch in on-webview-message does not await them, and long-running history-range delivery must keep yielding so cancelTask items queued behind it reach this module's observer between chunks [D-fire-and-forget-handlers].

import { CHAT_TASK_CANCEL_TASK, contextEventNames } from "@jabberwock/types"
import type {
	ClientTarget,
	ContextMessageRole,
	DescribeRequest,
	HistoryRangeRequest,
	RecallRequest,
	SearchRequest,
	WebviewMessage,
} from "@jabberwock/types"

import type { ProviderHandle } from "@features/foundation/webview/EventBridge"
import { onWebviewMessage } from "@features/foundation/webview/events/handlers/on-webview-message"

import { KNOWN_CONTEXT_ROLES } from "@features/context/services/ContextArchiveService"
import { describeNode, searchArchivedContext } from "@features/context/services/ContextSearchService"
import { recallRange } from "@features/context/services/ContextRecallService"
import { runHistoryRangeDelivery } from "@features/context/actions/history-delivery"
import { valueArrayStrings, valueNumber, valueString } from "@features/context/actions/param-extraction"

interface InFlightHistoryEntry {
	taskId: string
	requestId: string
	senderClientId?: string
	cancelled: boolean // flipped by the cancel observer; the delivery loop detects it between chunks and sends the ack itself (single-sender rule, no double-ack race).
}

// Registry of in-flight history-range deliveries keyed task+requestId [D-history-dedup-inflight-suppress]: a duplicate request for an already-running key is ignored so one logical request never delivers twice concurrently; after completion a re-send runs normally and yields identical results because the archive window bounds are fixed.
const inFlightHistories = new Map<string, InFlightHistoryEntry>()

let registered = false // idempotency guard - bootstrap runs once per process but dev reloads must not double-register [D-registration-idempotent].

function logWarn(message: string): void {
	console.warn(`[jabberwock] [context-actions] ${message}`)
}

/** Register the context graph intent handlers (section 8.1). Explicit registration is what makes the INTENT_PRIORITY table apply - bus.ts defaults unknown types to Normal, so recall/search/describe would silently lose their High(1) guarantee without these entries. */
export function registerContextIntents(): void {
	if (registered) return
	registered = true

	// High(1): same level as tool.execution.required - semantically it IS tool execution.
	onWebviewMessage(contextEventNames.searchRequested, handleSearchRequest)
	// High(1): model waits on the result in the turn-critical path (R6).
	onWebviewMessage(contextEventNames.recallRequested, handleRecallRequest)
	// High(1): drill-down targeting step of the describe->recall two-step.
	onWebviewMessage(contextEventNames.describeRequested, handleDescribeRequest)
	// Normal(2): user-initiated viewport fetches must never block newer content or model recall.
	onWebviewMessage(contextEventNames.historyRangeRequested, handleHistoryRangeRequest)

	// ICG-C2 scope: this observer only interrupts in-flight context history-range deliveries [D-cancel-scope-history-only]. In extension mode a later setupIntentBus registration may overwrite the "cancelTask" slot - recorded deviation, full dual-mode wiring lands with Phase D1 (see bootstrap comment).
	onWebviewMessage(CHAT_TASK_CANCEL_TASK, handleTaskCancelObserver)
}

/** Targeted outbound for response frames: addressed to the requesting client when its id is known, broadcast otherwise [D-response-targeting]. */
function targetFor(senderClientId?: string): ClientTarget | undefined {
	return senderClientId ? { kind: "client", clientId: senderClientId } : undefined
}

async function sendFrame(
	provider: ProviderHandle,
	frame: Record<string, unknown>,
	target?: ClientTarget,
): Promise<boolean> {
	try {
		// frames bypass IntentBus/MST like streamChunk (streaming exception pattern); the connector wraps them in its envelope and resolves targeting per v4 section 6.3.
		return await provider.postMessageToWebview(frame, target)
	} catch (error) {
		console.error(`[jabberwock] [context-actions] outbound failed for frame type ${String(frame.type)}:`, error)
		return false // undeliverable - callers treat this as terminal for the stream [D-stop-on-undeliverable].
	}
}

/** Build a SearchRequest from the wire message; null when no usable query is present. Flat declared fields win over values nesting [D-frames-values-nesting]. */
function buildSearchRequest(message: WebviewMessage): SearchRequest | null {
	const query =
		typeof message.query === "string" && message.query.length > 0 ? message.query : valueString(message, "query")
	if (typeof query !== "string" || query.trim().length === 0) return null

	const scopeRaw = valueString(message, "scope")
	// out-of-domain values dropped here AND re-validated in the service (defense in depth).
	const roleFilter: ContextMessageRole[] | undefined = buildRoleFilter(valueArrayStrings(message, "roleFilter"))

	return {
		type: contextEventNames.searchRequested,
		query,
		taskId: message.taskId ?? valueString(message, "taskId"),
		scope: scopeRaw === "messages" || scopeRaw === "summaries" ? scopeRaw : undefined, // invalid or absent enum falls back to the protocol default (all) [D-invalid-enum-default].
		...(roleFilter !== undefined && roleFilter.length > 0 ? { roleFilter } : {}),
		limit: valueNumber(message, "limit"),
	}
}

function buildRoleFilter(raw?: string[]): ContextMessageRole[] | undefined {
	if (!raw || raw.length === 0) return undefined
	const out = new Set<ContextMessageRole>()
	for (const role of raw) for (const known of KNOWN_CONTEXT_ROLES) if (known === role) out.add(known) // no cast needed: compare against the exported domain list and add its typed members.
	return out.size > 0 ? [...out] : undefined
}

/** Build a RecallRequest from the wire message. All locator fields are optional per protocol; an unresolvable request degrades to an empty recallResponse frame rather than silence so the UI panel always gets an answer [D-recall-always-answers]. */
function buildRecallRequest(message: WebviewMessage): RecallRequest {
	return {
		type: contextEventNames.recallRequested,
		nodeId: valueString(message, "nodeId"),
		fromSeq: valueNumber(message, "fromSeq"),
		toSeq: valueNumber(message, "toSeq"),
		maxTokens: valueNumber(message, "maxTokens"),
	}
}

/** Build a DescribeRequest from the wire message; null when any required field (taskId, fromSeq, toSeq) is missing [D-describe-required-fields]. */
function buildDescribeRequest(message: WebviewMessage): DescribeRequest | null {
	const taskId =
		typeof message.taskId === "string" && message.taskId.length > 0
			? message.taskId
			: valueString(message, "taskId")
	if (!taskId) return null

	const fromSeq = valueNumber(message, "fromSeq")
	const toSeqRaw = valueNumber(message, "toSeq")
	if (fromSeq === undefined || toSeqRaw === undefined) return null // a point describe may pass the same seq twice; both must be present.

	return { type: contextEventNames.describeRequested, taskId, fromSeq, toSeq: toSeqRaw }
}

/** Build a HistoryRangeRequest from the wire message; null when either required field (taskId, requestId) is missing [D-history-required-fields]. */
function buildHistoryRangeRequest(message: WebviewMessage): HistoryRangeRequest | null {
	const taskId =
		typeof message.taskId === "string" && message.taskId.length > 0
			? message.taskId
			: valueString(message, "taskId")
	if (!taskId) return null

	// requestId is a declared flat field on WebviewMessage; fall back to values nesting for clients that send it structured.
	const requestId =
		typeof message.requestId === "string" && message.requestId.length > 0
			? message.requestId
			: valueString(message, "requestId")
	if (!requestId) return null

	return {
		type: contextEventNames.historyRangeRequested,
		taskId,
		requestId,
		anchorSeq: valueNumber(message, "anchorSeq"),
		fromSeq: valueNumber(message, "fromSeq"),
		toSeq: valueNumber(message, "toSeq"),
		pageSize: valueNumber(message, "pageSize"),
	}
}

function handleSearchRequest(provider: ProviderHandle, message: WebviewMessage, senderClientId?: string): void {
	const request = buildSearchRequest(message)
	if (!request) return // missing/empty query - protocol defines no error frame for search; the panel simply gets nothing to render.
	void (async () => {
		const results = searchArchivedContext(request)
		await sendFrame(provider, { type: contextEventNames.searchResponse, results }, targetFor(senderClientId))
	})() // fire-and-forget [D-fire-and-forget-handlers].
}

function handleRecallRequest(provider: ProviderHandle, message: WebviewMessage, senderClientId?: string): void {
	const request = buildRecallRequest(message)
	void (async () => {
		// always answers - unresolved locators yield an empty items array with a logged warning inside the service.
		const response = recallRange(request)
		await sendFrame(
			provider,
			{
				type: contextEventNames.recallResponse,
				items: response.items,
				truncatedFromMiddle: response.truncatedFromMiddle,
				...(response.nodeMeta !== undefined ? { nodeMeta: response.nodeMeta } : {}),
			},
			targetFor(senderClientId),
		)
	})() // fire-and-forget [D-fire-and-forget-handlers].
}

function handleDescribeRequest(provider: ProviderHandle, message: WebviewMessage, senderClientId?: string): void {
	const request = buildDescribeRequest(message)
	if (!request) {
		logWarn("describe dropped: missing required field (taskId/fromSeq/toSeq)")
		return
	}
	void (async () => {
		// never null - leaf fallback keeps the panel renderable while rollups are absent [D-describe-leaf-fallback].
		const response = describeNode(request)
		await sendFrame(
			provider,
			{
				type: contextEventNames.describeResponse,
				nodeId: response.nodeId,
				depth: response.depth,
				descendantCount: response.descendantCount,
				summaryText: response.summaryText,
			},
			targetFor(senderClientId),
		)
	})() // fire-and-forget [D-fire-and-forget-handlers].
}

function handleHistoryRangeRequest(provider: ProviderHandle, message: WebviewMessage, senderClientId?: string): void {
	const request = buildHistoryRangeRequest(message)
	if (!request) {
		logWarn("history-range dropped: missing required field (taskId/requestId)")
		return
	}

	// Idempotent dedup [D-history-dedup-inflight-suppress]: a duplicate for an already-running key is ignored; the original delivery covers it and re-sends after completion yield identical results.
	const key = historyRegistryKey(request.taskId, request.requestId) // NUL-separated task+request id [D-history-key-format].
	if (inFlightHistories.has(key)) {
		logWarn(`history-range ${request.requestId} dropped: duplicate of an in-flight request`)
		return
	}

	inFlightHistories.set(
		key,
		{ taskId: request.taskId, requestId: request.requestId, senderClientId, cancelled: false }, // registry entry; the cancel observer flips .cancelled between chunks.
	)
	void (async () => {
		try {
			await runHistoryRangeDelivery({
				request,
				provider,
				target: targetFor(senderClientId), // the delivery loop owns all outbound frames for this stream including the cancel ack.
				isCancelled: () => inFlightHistories.get(key)?.cancelled === true, // live probe into the registry entry - handleTaskCancelObserver flips it between chunks [D-history-cancel-between-chunks].
			})
		} finally {
			inFlightHistories.delete(key)
		}
	})() // fire-and-forget [D-fire-and-forget-handlers] - the send loop runs in the background with its own awaits while queued items (including cancelTask) keep draining.
}

function historyRegistryKey(taskId: string, requestId: string): string {
	return `${taskId}\u0000${requestId}` // NUL separator keeps arbitrary task/request id characters unambiguous [D-history-key-format].
}

/** Cancel observer for in-flight context deliveries (section 8.2 decision). A cancel only matches when it carries the history requestId - bare taskId-only cancels are chat-turn cancellations owned by the existing pipeline and must not touch viewport streams [D-cancel-requires-requestid]. The flag flip is all this handler does; the delivery loop detects it between chunks, sends context.history.cancelled to the requesting client ONLY, and terminates itself (single-sender rule). */
function handleTaskCancelObserver(_provider: ProviderHandle, message: WebviewMessage): void {
	const taskId =
		typeof message.taskId === "string" && message.taskId.length > 0
			? message.taskId
			: valueString(message, "taskId")
	if (!taskId) return // untargeted cancel cannot match any task-scoped registry entry.

	// requestId is a declared flat field on WebviewMessage; fall back to values nesting for clients that send it structured.
	const requestId =
		typeof message.requestId === "string" && message.requestId.length > 0
			? message.requestId
			: valueString(message, "requestId")
	if (!requestId) return // [D-cancel-requires-requestid] - no correlation id means this is not a context delivery cancel.

	const entry = inFlightHistories.get(historyRegistryKey(taskId, requestId))
	if (entry === undefined || entry.cancelled) return // unknown or already cancelling - nothing to do (the loop will ack exactly once).
	entry.cancelled = true
}
