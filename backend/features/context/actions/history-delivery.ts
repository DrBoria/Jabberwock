// ICG-C2 chunked history-range delivery over the context archive (streaming exception pattern, spec sections 6.2/6.3/8.2): pages go straight through the provider outbound path (bypassing IntentBus/MST like streamChunk), each targeted at the requesting client, with a cancellation check and an event-loop yield between chunks so queued cancelTask items can interrupt in-flight streams [D-history-cancel-between-chunks]. Sibling module of context-actions.ts (which owns the intent registration, the in-flight dedup registry and the cancel observer): the delivery loop lives here so both modules stay within their line budgets, and the [context-actions] log prefix is preserved so outbound diagnostics are unchanged.

import { contextEventNames } from "@jabberwock/types"
import type { ClientTarget, HistoryRangeRequest } from "@jabberwock/types"

import type { ProviderHandle } from "@features/foundation/webview/EventBridge"

import { getContextDatabase } from "@features/context/services/ContextArchiveService"
import { fetchHistoryPage, resolveHistorySpan } from "@features/context/services/ContextRecallService"

export interface HistoryRangeDeliveryOptions {
	request: HistoryRangeRequest
	provider: ProviderHandle
	target?: ClientTarget // the requesting client; required for the cancel ack, optional otherwise.
	isCancelled?: () => boolean // injected cancellation probe (defaults to never-cancelled) so unit tests can drive interruption without touching the registry [D-history-di-cancellation].
}

export interface HistoryRangeRunResult {
	completed: boolean // true only when every page of the resolved window was delivered and the completed frame went out.
	cancelled: boolean // true when interrupted by cancel or an undeliverable target (terminal either way).
}

function logWarn(message: string): void {
	console.warn(`[jabberwock] [context-actions] ${message}`)
}

/** Send context.history.cancelled to the requesting client ONLY [D-cancel-ack-requires-sender-id]; without a target there is nobody to acknowledge, so the ack stays unsent and only gets logged. */
async function sendCancelAck(options: HistoryRangeDeliveryOptions, chunkIndex: number): Promise<boolean> {
	logWarn(`history-range ${options.request.requestId} cancelled after chunk ${chunkIndex - 1}`)
	const hasTarget = options.target !== undefined
	if (!hasTarget) return false // no requesting client id on this delivery - nothing to acknowledge.

	// fresh literal at the call site on purpose - protocol-typed consts are not assignable to Record<string, unknown> without casts (forbidden).
	const ackSent = await sendFrame(
		options.provider,
		{
			type: contextEventNames.historyCancelled,
			taskId: options.request.taskId,
			requestId: options.request.requestId,
		},
		options.target,
	)
	if (!ackSent) logWarn(`history-range ${options.request.requestId} cancel ack undeliverable`)
	return ackSent
}

/** Chunked delivery of one history-range request per section 6.3 streaming exception pattern: pages go straight through the provider outbound path (bypassing IntentBus/MST like streamChunk), each targeted at the requesting client, with a cancellation check and an event-loop yield between chunks so queued cancelTask items can interrupt in-flight streams [D-history-cancel-between-chunks]. */
export async function runHistoryRangeDelivery(options: HistoryRangeDeliveryOptions): Promise<HistoryRangeRunResult> {
	const db = getContextDatabase()
	if (!db) return { completed: false, cancelled: false } // degraded mode - logged once by the owning service at initialization.

	const resolved = resolveHistorySpan(db, options.request)
	if (resolved === null) {
		logWarn(`history-range ${options.request.requestId} dropped: unresolved span or empty task`)
		return { completed: false, cancelled: false } // invalid request or no archived rows - protocol defines no error frame for this case.
	}

	const { span, stats } = resolved
	const isCancelled = options.isCancelled ?? (() => false)
	let afterSeq: number | undefined
	let chunkIndex = 0
	let deliveredCount = 0

	while (deliveredCount < stats.totalCount) {
		// termination by task-wide count [D-history-page-termination] - avoids the exactly-divisible extra empty fetch.
		const page = fetchHistoryPage(db, options.request.taskId, span, afterSeq)
		if (page.items.length === 0 || page.lastSeq === null) break // defensive: no progress possible; should not happen while deliveredCount < totalCount.

		// fresh literal at the call site on purpose - protocol-typed consts are not assignable to Record<string, unknown> without casts (forbidden).
		const sentChunk = await sendFrame(
			options.provider,
			{
				type: "context.history.chunk",
				taskId: options.request.taskId,
				requestId: options.request.requestId,
				chunkIndex,
				items: page.items,
			},
			options.target,
		)
		if (!sentChunk) return { completed: false, cancelled: true } // undeliverable target = client gone; stop [D-stop-on-undeliverable].

		deliveredCount += page.items.length
		afterSeq = page.lastSeq
		chunkIndex += 1

		if (isCancelled()) {
			await sendCancelAck(options, chunkIndex)
			return { completed: false, cancelled: true } // single sender for the ack - the observer only flips the flag [D-history-cancel-between-chunks].
		}

		await yieldToEventLoop() // explicit macrotask yield so queued items (cancelTask included) drain between chunks even when nothing else is in flight.
	}

	const completedSent = await sendFrame(
		options.provider,
		{
			type: "context.history.completed",
			taskId: options.request.taskId,
			requestId: options.request.requestId,
			minSeq: span.loSeq,
			maxSeq: span.hiSeq,
			totalCount: stats.totalCount,
			approxMidpoint: Math.floor((span.loSeq + span.hiSeq) / 2),
			truncatedFromMiddle: false,
		},
		options.target,
	) // delivered page boundaries per section 6.2; approxMidpoint from the resolved window [decision recorded in ICG-C2].

	return { completed: completedSent, cancelled: !completedSent }
}

function yieldToEventLoop(): Promise<void> {
	return new Promise((resolve) => setImmediate(resolve)) // Node-only API - this module only runs inside backend hosts.
}

/** Shared outbound frame path for the chunked delivery stream: frames bypass IntentBus/MST like streamChunk and are wrapped by the connector per v4 section 6.3; a failed send is terminal for the stream [D-stop-on-undeliverable]. */
async function sendFrame(
	provider: ProviderHandle,
	frame: Record<string, unknown>,
	target?: ClientTarget,
): Promise<boolean> {
	try {
		return await provider.postMessageToWebview(frame, target)
	} catch (error) {
		console.error(`[jabberwock] [context-actions] outbound failed for frame type ${String(frame.type)}:`, error)
		return false // undeliverable - callers treat this as terminal for the stream [D-stop-on-undeliverable].
	}
}
