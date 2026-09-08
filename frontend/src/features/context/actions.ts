/**
 * Context display action creators (ICG-D1, spec §7/§8.2).
 *
 * These dispatch the context display protocol over `IConnectorEventBus` ONLY
 * (zero `postMessage` in app-level code — v4 G2/G3 and C-4). Outbound requests
 * are published with a body-level `requestId` for per-client targeted responses
 * and idempotent dedup (spec §8.2). Inbound `chunk`/`completed`/`recall`/`state`
 * frames are handled by the bus subscription in `store-singleton.ts`.
 */

import { getConnectorBus } from "../../connector-bus"
import type { HistoryRangeRequest, RecallRequest, WebviewMessage } from "@jabberwock/types"

export interface HistoryRangeRequestOptions {
	taskId: string
	requestId: string
	anchorSeq?: number
	fromSeq?: number
	toSeq?: number
	pageSize?: number
	direction?: "up" | "down"
}

export interface RecallNodeOptions {
	nodeId?: string
	fromSeq?: number
	toSeq?: number
	maxTokens?: number
}

/**
 * Request a viewport page of history (spec §7.2). Normal-priority on the backend.
 * With only `anchorSeq` the server pages around it; an explicit `fromSeq`/`toSeq`
 * range wins over the anchor (spec §7.2 [decision]).
 */
export function requestHistoryRange(args: HistoryRangeRequestOptions) {
	const request: HistoryRangeRequest = {
		type: "context.history.range.requested",
		taskId: args.taskId,
		requestId: args.requestId,
		anchorSeq: args.anchorSeq,
		fromSeq: args.fromSeq,
		toSeq: args.toSeq,
		pageSize: args.pageSize,
		direction: args.direction,
	}
	// The ICG display frames ride the bus envelope, not the static WebviewMessage
	// union; the catch-all member of the union accepts any `type`-tagged body.
	getConnectorBus().publish(request as WebviewMessage)
}

/**
 * Expand a node / seq range back to RAW content (lossless, spec §7.5).
 * High-priority on the backend so expansion is fast even while compression runs.
 */
export function recallNode(args: RecallNodeOptions) {
	const request: RecallRequest = {
		type: "context.recall.requested",
		nodeId: args.nodeId,
		fromSeq: args.fromSeq,
		toSeq: args.toSeq,
		maxTokens: args.maxTokens,
	}
	getConnectorBus().publish(request as WebviewMessage)
}
