/**
 * EventBus — typed pub/sub singleton for devtool↔UI synchronization.
 *
 * Bridges the gap between extension messages (window.postMessage),
 * devtool MCP commands, and React component state. Every ask, state
 * change, or navigation event flows through this bus so that both
 * the DOM and the devtool always see the same data.
 */

export type EventType =
	| "ASK_RECEIVED"
	| "ASK_RESPONDED"
	| "STATE_CHANGED"
	| "DOM_REQUESTED"
	| "NAVIGATION"
	| "MESSAGE_SENT"
	| "TASK_STARTED"
	| "TASK_STOPPED"
	| "MCP_SERVER_REQUEST"
	| "TODO_UPDATED"

export interface AskEvent {
	type: string // e.g. "use_mcp_server", "tool", "followup"
	messageTs: number
	text: string
	isPartial: boolean
	primaryButtonText?: string
	secondaryButtonText?: string
}

export interface StateChangeEvent {
	key: string
	value: unknown
}

export interface McpServerRequestEvent {
	serverName: string
	toolName?: string
	params?: unknown
	response?: unknown
}

type Handler = (data: unknown) => void

class EventBus {
	private listeners = new Map<EventType, Set<Handler>>()
	private lastEvent = new Map<EventType, unknown>()

	publish(type: EventType, data: unknown): void {
		this.lastEvent.set(type, data)
		this.listeners.get(type)?.forEach((handler) => {
			try {
				handler(data)
			} catch (err) {
				console.error(`[EventBus] Handler error for ${type}:`, err)
			}
		})
	}

	subscribe(type: EventType, handler: Handler): () => void {
		if (!this.listeners.has(type)) {
			this.listeners.set(type, new Set())
		}
		this.listeners.get(type)!.add(handler)

		// Replay last event for late subscribers
		const last = this.lastEvent.get(type)
		if (last !== undefined) {
			try {
				handler(last)
			} catch (err) {
				console.error(`[EventBus] Replay handler error for ${type}:`, err)
			}
		}

		return () => {
			this.listeners.get(type)?.delete(handler)
		}
	}

	getLastEvent(type: EventType): unknown {
		return this.lastEvent.get(type)
	}

	clear(): void {
		this.listeners.clear()
		this.lastEvent.clear()
	}
}

export const eventBus = new EventBus()
