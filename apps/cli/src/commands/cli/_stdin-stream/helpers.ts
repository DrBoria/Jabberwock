import { isRecord } from "@/lib/utils/validation/guards.js"

import type { ExtensionHost } from "@/agent/index.js"
import type { StreamQueueItem } from "./types.js"
import {
	CANCEL_RECOVERY_POLL_INTERVAL_MS,
	CANCEL_RECOVERY_WAIT_TIMEOUT_MS,
	MESSAGE_AS_ASK_RESPONSE_ASKS,
	RESUME_ASKS,
	STDIN_EOF_IDLE_ASKS,
	STDIN_EOF_IDLE_STABLE_POLLS,
	STDIN_EOF_POLL_INTERVAL_MS,
	STDIN_EOF_RESUME_WAIT_TIMEOUT_MS,
} from "./types.js"

export function shouldSendMessageAsAskResponse(waitingForInput: boolean, currentAsk: string | undefined): boolean {
	return waitingForInput && typeof currentAsk === "string" && MESSAGE_AS_ASK_RESPONSE_ASKS.has(currentAsk)
}

export function isResumableState(host: ExtensionHost): boolean {
	const agentState = host.client.getAgentState()
	return (
		agentState.isWaitingForInput &&
		typeof agentState.currentAsk === "string" &&
		RESUME_ASKS.has(agentState.currentAsk)
	)
}

export function normalizeQueueText(text: string | undefined): string | undefined {
	if (!text) return undefined
	const compact = text.replace(/\s+/g, " ").trim()
	if (!compact) return undefined
	return compact.length <= 180 ? compact : `${compact.slice(0, 177)}...`
}

export function parseQueueSnapshot(rawQueue: unknown): StreamQueueItem[] | undefined {
	if (!Array.isArray(rawQueue)) return undefined
	const snapshot: StreamQueueItem[] = []
	for (const entry of rawQueue) {
		if (!isRecord(entry)) continue
		const idRaw = entry.id
		if (typeof idRaw !== "string" || idRaw.trim().length === 0) continue
		const imagesRaw = entry.images
		const timestampRaw = entry.timestamp
		const imageCount = Array.isArray(imagesRaw) ? imagesRaw.length : 0
		snapshot.push({
			id: idRaw,
			text: normalizeQueueText(typeof entry.text === "string" ? entry.text : undefined),
			imageCount,
			timestamp: typeof timestampRaw === "number" ? timestampRaw : undefined,
		})
	}
	return snapshot
}

export function areStringArraysEqual(a: string[], b: string[]): boolean {
	if (a.length !== b.length) return false
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false
	}
	return true
}

export async function waitForPostCancelRecovery(host: ExtensionHost): Promise<void> {
	const deadline = Date.now() + CANCEL_RECOVERY_WAIT_TIMEOUT_MS
	while (Date.now() < deadline) {
		if (isResumableState(host)) return
		await new Promise((resolve) => setTimeout(resolve, CANCEL_RECOVERY_POLL_INTERVAL_MS))
	}
}

async function isEofIdleStable(host: ExtensionHost, currentAsk: string): Promise<boolean> {
	for (let i = 1; i < STDIN_EOF_IDLE_STABLE_POLLS; i++) {
		await new Promise((resolve) => setTimeout(resolve, STDIN_EOF_POLL_INTERVAL_MS))
		if (!host.client.hasActiveTask() || !host.isWaitingForInput()) return false
		const nextAsk = host.client.getCurrentAsk()
		if (nextAsk !== currentAsk) return false
	}
	return true
}

async function waitForInputWithTimeout(host: ExtensionHost): Promise<boolean> {
	const deadline = Date.now() + STDIN_EOF_RESUME_WAIT_TIMEOUT_MS
	while (Date.now() < deadline) {
		if (!host.client.hasActiveTask() || !host.isWaitingForInput()) return false
		await new Promise((resolve) => setTimeout(resolve, STDIN_EOF_POLL_INTERVAL_MS))
	}
	return true
}

export async function waitForTaskProgressAfterStdinClosed(
	host: ExtensionHost,
	getQueueState: () => { hasSeenQueueState: boolean; queueDepth: number },
): Promise<void> {
	while (host.client.hasActiveTask()) {
		if (!host.isWaitingForInput()) {
			await new Promise((resolve) => setTimeout(resolve, STDIN_EOF_POLL_INTERVAL_MS))
			continue
		}
		const stillActive = await waitForInputWithTimeout(host)
		if (!stillActive) continue
		const currentAsk = host.client.getCurrentAsk()
		const { hasSeenQueueState, queueDepth } = getQueueState()
		if (
			hasSeenQueueState &&
			queueDepth === 0 &&
			typeof currentAsk === "string" &&
			STDIN_EOF_IDLE_ASKS.has(currentAsk)
		) {
			if (await isEofIdleStable(host, currentAsk)) return
		}
		throw new Error(`stdin ended while task was waiting for input (${currentAsk ?? "unknown"})`)
	}
}
