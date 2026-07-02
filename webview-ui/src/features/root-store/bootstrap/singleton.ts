import { onAction } from "mobx-state-tree"

import { setupIntents } from "../../intents"
import type { FrontendActionLogEntry } from "../types"
import { RootStore } from "../store"
import type { IRootStore } from "../store"

// ─── Singleton state ────────────────────────────────────────────────
let _rootStore: IRootStore | null = null
const _actionBuffer: FrontendActionLogEntry[] = []
let _disposeIntentBus: (() => void) | null = null

// ─── Factory ────────────────────────────────────────────────────────
export function createRootStore(): IRootStore {
	if (_rootStore) return _rootStore
	_rootStore = RootStore.create({
		didHydrateState: false,
		showWelcome: false,
		_welcomeDismissed: false,
		filePaths: [],
		openedTabs: [],
		extensionCommands: [],
		interactiveAppUri: "",
		currentCheckpoint: "",
	})
	onAction(_rootStore, (call: { name: string; path?: string; args?: unknown[] }) => {
		_actionBuffer.push({ name: call.name, path: call.path ?? "", args: call.args ?? [], timestamp: Date.now() })
		if (_actionBuffer.length > 500) _actionBuffer.shift()
	})
	const { dispose } = setupIntents(_rootStore)
	_disposeIntentBus = dispose
	return _rootStore
}

export function getRootStore() {
	if (!_rootStore) throw new Error("RootStore not initialized. Call createRootStore() first.")
	return _rootStore
}

export function getFrontendActionBuffer() {
	return _actionBuffer
}

export function disposeIntentBus() {
	if (_disposeIntentBus) {
		_disposeIntentBus()
		_disposeIntentBus = null
	}
}

// Backward-compatible singleton reference (initialized lazily)
export const rootStore = createRootStore()
