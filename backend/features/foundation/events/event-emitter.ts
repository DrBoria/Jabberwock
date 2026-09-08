import type { DisposableLike } from "@jabberwock/types"

/**
 * Host-neutral event emitter (D4g-2 batch 3).
 *
 * Replaces `vscode.EventEmitter` in shared backend code so the server bundle stays free of host
 * imports. Mirrors the `vscode.EventEmitter` surface (`event`, `fire`, `dispose`) that the
 * code-index state manager and file watcher use. The `event` accessor returns a subscription
 * function whose result is a `DisposableLike` that unsubscribes when disposed — matching the
 * `vscode.EventEmitter.event` contract that consumers rely on.
 */
export class EventEmitter<T> {
	private listeners = new Set<(e: T) => void>()

	/**
	 * Subscribe a listener. Returns a disposable that unsubscribes the listener when disposed.
	 * Mirrors `vscode.EventEmitter.event`.
	 */
	public get event(): (listener: (e: T) => void) => DisposableLike {
		return (listener: (e: T) => void): DisposableLike => {
			this.listeners.add(listener)
			return {
				dispose: () => {
					this.listeners.delete(listener)
				},
			}
		}
	}

	/** Emit an event to all current listeners. Mirrors `vscode.EventEmitter.fire`. */
	public fire(data: T): void {
		for (const listener of [...this.listeners]) {
			listener(data)
		}
	}

	/** Remove all listeners. Mirrors `vscode.EventEmitter.dispose`. */
	public dispose(): void {
		this.listeners.clear()
	}
}
