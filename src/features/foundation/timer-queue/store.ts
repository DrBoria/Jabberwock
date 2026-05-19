import { types, Instance } from "mobx-state-tree"
import type { EventBridge } from "../../../core/webview/EventBridge"

// Lazy require to avoid circular dependency: store.ts → foundation/store.ts → timer-queue/store.ts → store.ts
function lazyGetState(provider: EventBridge): { foundation: { timerQueue: unknown } } {
	const storeModule = require("../../store") as { getState: (p: EventBridge) => unknown }
	const rootStore = storeModule.getState(provider)
	return rootStore as { foundation: { timerQueue: unknown } }
}

export const TimerQueueModel = types.model("TimerQueue", {})

export type ITimerQueueModel = Instance<typeof TimerQueueModel>

// Backward-compatible types and functions
/** Timer queue instances can be stored here */
export type TimerQueueState = object

export function initTimerQueueState(_provider: EventBridge): void {
	// No-op — state is initialized via MST model defaults
}

export function getTimerQueueState(provider: EventBridge): TimerQueueState {
	return lazyGetState(provider).foundation.timerQueue as TimerQueueState
}

/**
 * Creates a timer queue store instance.
 */
export function createTimerQueueStore(): {
	start: (cb: () => void, ms: number) => void
	stop: () => void
	cancel: (ref: ReturnType<typeof setTimeout>) => void
	schedule: (opts: { id: string; label: string; timeoutMs: number }) => {
		id: string
		label: string
		timeoutMs: number
	}
	createTimeoutPromise: (ref: { timeoutMs: number }, message: string) => Promise<never>
} {
	let timer: ReturnType<typeof setTimeout> | undefined

	function stop() {
		if (timer) {
			clearTimeout(timer)
			timer = undefined
		}
	}

	return {
		start: (cb, ms) => {
			stop()
			timer = setTimeout(cb, ms)
		},
		stop,
		cancel: (ref) => {
			clearTimeout(ref)
			if (timer === ref) {
				timer = undefined
			}
		},
		schedule: (opts) => {
			return opts
		},
		createTimeoutPromise: (ref, message) => {
			return new Promise<never>((_, reject) => {
				setTimeout(() => reject(new Error(message)), ref.timeoutMs)
			})
		},
	}
}
