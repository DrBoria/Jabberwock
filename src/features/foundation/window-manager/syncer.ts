import { reaction } from "mobx"
import { getSnapshot } from "mobx-state-tree"
import type { ProviderHandle } from "@features/foundation/webview/EventBridge"
import type { IBackendRootStore } from "@features/store"
import { postStateToWebview, scheduleStatePush } from "./store/messaging"

/**
 * Set up MobX reactions that synchronize MST state changes to the webview.
 *
 * Rather than calling `postStateToWebview` imperatively from every action,
 * these reactions observe specific state atoms and push updates automatically:
 *
 * 1. `activeTaskId` changes → full state push
 * 2. `isRunning` changes → full state push
 * 3. Active task's notification array changes → debounced state push
 *
 * All reactions are disposed when the returned disposer is called (tied to
 * the webview view lifecycle via `webviewDisposables`).
 */
export function setupSyncer(provider: ProviderHandle, store: IBackendRootStore): () => void {
	const disposers: Array<() => void> = []

	// ── Reaction 1: activeTaskId → full state push ─────────────────────
	disposers.push(
		reaction(
			() => store.chat.activeTaskId,
			() => {
				postStateToWebview(provider).catch((err: unknown) => {
					console.error("[syncer] postStateToWebview (activeTaskId) failed:", err)
				})
			},
			{ name: "syncer-activeTaskId", fireImmediately: false },
		),
	)

	// ── Reaction 2: isRunning → full state push ───────────────────────
	disposers.push(
		reaction(
			() => store.chat.isRunning,
			() => {
				postStateToWebview(provider).catch((err: unknown) => {
					console.error("[syncer] postStateToWebview (isRunning) failed:", err)
				})
			},
			{ name: "syncer-isRunning", fireImmediately: false },
		),
	)

	// ── Reaction 3: active task notifications → debounced state push ──
	disposers.push(
		reaction(
			() => {
				const activeTask = store.chat.activeTask
				return activeTask ? getSnapshot(activeTask.notifications.items) : undefined
			},
			() => {
				scheduleStatePush(provider)
			},
			{ name: "syncer-notifications", fireImmediately: false },
		),
	)

	return () => {
		for (const dispose of disposers) {
			dispose()
		}
	}
}
