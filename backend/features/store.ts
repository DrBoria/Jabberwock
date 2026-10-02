import * as fs from "fs/promises"
import * as path from "path"
import { types, onAction, onSnapshot, Instance } from "mobx-state-tree"
import { ChatModel } from "@features/chat"
import { IntentStoreModel, setupIntents } from "@features/intents"
import type { IntentBus } from "@features/intents"
import { FoundationModel } from "@features/foundation"
import { HistoryModel } from "@features/hist"
import { CloudModel } from "@features/cloud"
import { MarketplaceModel } from "@features/marketplace"
import { SettingsModel } from "@features/settings"
import { FileContextTrackerStoreModel } from "@features/foundation/time-machine"
import { ContextWindowModel, createContextWindowState } from "@features/context"
import { AgentStore } from "@features/settings/agents"
import { setRootStore } from "@features/singleton"
import { loadSnapshot, sanitizeSnapshots } from "@features/snapshot"
import { EventLogModel } from "./eventlog/store"

// ─── Action log entry type ──────────────────────────────────────────
export interface ActionLogEntry {
	name: string
	path: string
	args: unknown[]
	timestamp: number
}

// ─── Root Model ─────────────────────────────────────────────────────
export const BackendRootModel = types
	.model("BackendRoot", {
		chat: types.optional(ChatModel, () => ({
			streaming: { entries: {} },
			checkpoint: { entries: {} },
			tasks: {},
			activeTaskId: undefined,
		})),
		foundation: types.optional(FoundationModel, () => ({
			windowManager: {
				view: null,
				disposables: [],
				webviewDisposables: [],
				viewLaunched: false,
				workspaceStore: null,
				workspaceTracker: null,
				pendingDomRequests: new Map(),
				pendingActivePageRequests: new Map(),
				pendingPushTimers: new Map(),
			},
			agentState: { pendingEditOp: "" },
			mst: {},
			timerQueue: {},
		})),
		history: types.optional(HistoryModel, {
			items: [],
			currentTaskId: "",
		}),
		settings: SettingsModel,
		cloud: CloudModel,
		marketplace: MarketplaceModel,
		intentStore: types.optional(IntentStoreModel, () => ({
			intents: [],
		})),
		fileContextTracker: types.optional(FileContextTrackerStoreModel, () => ({
			entries: {},
		})),
		eventLog: types.array(EventLogModel),
		context: types.optional(ContextWindowModel, createContextWindowState()),
		agents: types.optional(AgentStore, () => ({
			tools: {},
			agents: {},
			toolModelRouting: {},
		})),
	})
	.actions((self) => ({
		logEvent(event: { type: string; ts: number; direction: "outgoing" | "incoming"; payload: unknown }) {
			self.eventLog.push(event)
			if (self.eventLog.length > 1000) {
				self.eventLog.splice(0, self.eventLog.length - 1000)
			}
		},
		runHandler<T>(fn: () => T): T {
			return fn()
		},
	}))

export type IBackendRootStore = Instance<typeof BackendRootModel>
export type FeatureState = IBackendRootStore

// ─── Store factory options ──────────────────────────────────────────
interface InitOptions {
	/** File‑system path to the extension's globalStorage directory for HMR snapshot persistence. */
	globalStoragePath?: string
}

// ─── Singleton + onAction buffer ───────────────────────────────────
const _actionBuffer: ActionLogEntry[] = []

/** Singleton IntentBus — set by setupIntents(), used by extension.ts for handler registration. */
const __moduleState = {
	_intentBus: null as IntentBus | null,
}
/**
 * Get the singleton IntentBus for handler registration.
 *
 * Called from "extension.ts" after createBackendRootStore() to register
 * feature handlers on the bus.
 */
export function getIntentBus(): IntentBus | null {
	return __moduleState._intentBus
}

export function createBackendRootStore(options?: InitOptions): IBackendRootStore {
	const snapshot = loadSnapshot(options?.globalStoragePath)

	sanitizeSnapshots(snapshot)

	const rootStore = BackendRootModel.create(snapshot)

	setRootStore(rootStore)

	const { bus } = setupIntents(rootStore)
	__moduleState._intentBus = bus

	if (options?.globalStoragePath) {
		const snapPath = path.join(options.globalStoragePath, ".backend-snapshot.json")
		onSnapshot(rootStore, (snap) => {
			void fs.writeFile(snapPath, JSON.stringify(snap), "utf-8")
		})
	}

	onAction(rootStore, (call) => {
		_actionBuffer.push({
			name: call.name,
			path: call.path ?? "",
			args: call.args ?? [],
			timestamp: Date.now(),
		})
		if (_actionBuffer.length > 100) _actionBuffer.shift()
	})

	return rootStore
}

export function getActionBuffer(): ActionLogEntry[] {
	return _actionBuffer
}
