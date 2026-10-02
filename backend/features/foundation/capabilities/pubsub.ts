import { EventEmitter } from "node:events"

import type { DisposableLike, IPubSub } from "@jabberwock/types"

/**
 * v1 pub/sub topic names (plan §4.3). Topic strings are part of the connector protocol —
 * transports subscribe to these and fan payloads out over their own channel.
 */
export const PubsubTopics = {
	CLIENT_CONNECTED: "client.connected",
	CLIENT_DISCONNECTED: "client.disconnected",
	TASK_EVENT_PREFIX: "task.event.", // relay TaskEvent from "api/ipc.ts" as `task.event.<eventName>`
	NOTIFICATION_ASK: "notification.ask",
	NOTIFICATION_ASK_RESOLVED: "notification.ask.resolved",
	/** Replacement for vscode.window.showErrorMessage (~20+ call sites, plan §2.3 L12). */
	NOTIFICATION_ERROR: "notification.error",
} as const

export type PubsubTopic = (typeof PubsubTopics)[keyof typeof PubsubTopics] | string

/** Payload of the `notification.error` topic — transport-agnostic error notification (§4.3/L12). */
export interface NotificationErrorPayload {
	message: string
	details?: unknown
}

const MAX_LISTENERS_PER_TOPIC = 50

/**
 * Node EventEmitter-backed implementation of the pub/sub capability (plan §4.3 «eventEmitter»).
 * Topics replace ad-hoc EventEmitters so transports can relay backend events uniformly:
 * vscode mode fans out to webview postMessage, server mode over WS frames — same topic stream.
 */
export function EventBusPubSub(): IPubSub & { listenerCount(topic: string): number } {
	const emitter = new EventEmitter()
	emitter.setMaxListeners(MAX_LISTENERS_PER_TOPIC)

	function publish(topic: string, payload: unknown): void {
		try {
			emitter.emit(topic, payload)
		} catch (error) {
			console.error(`[capabilities] pubsub handler error on topic "${topic}":`, error)
		}
	}

	function subscribe(topic: string, handler: (payload: unknown) => void): DisposableLike {
		const wrapped = (payload: unknown): void => {
			try {
				handler(payload)
			} catch (error) {
				console.error(`[capabilities] pubsub subscriber error on topic "${topic}":`, error)
			}
		}
		emitter.on(topic, wrapped)
		return { dispose: () => emitter.off(topic, wrapped) }
	}

	/** Test/telemetry helper — number of live subscribers for a topic. */
	function listenerCount(topic: string): number {
		return emitter.listenerCount(topic)
	}

	return { publish, subscribe, listenerCount }
}
