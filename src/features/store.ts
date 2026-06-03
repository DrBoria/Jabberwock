import { types, onAction, onSnapshot, Instance, getSnapshot, applySnapshot } from "mobx-state-tree"
import { ChatModel } from "./chat/store"
import { IntentStoreModel, setupIntents } from "./intents"
import type { IntentBus } from "./intents"
import { FoundationModel } from "./foundation/store"
import { HistoryModel } from "./history/store"
import { CloudModel } from "./cloud/store"
import { MarketplaceModel } from "./marketplace/store"

import { ApiConfigModel } from "./settings/models/api-config-store"
import { FilesModel } from "./foundation/time-machine/files/store"
import { McpModel } from "./settings/mcp/store"
import { ModelsModel } from "./settings/models/store"
import { ModesModel } from "./settings/agents/store"
import { PromptsModel } from "./settings/context/store"
import { SkillsModel } from "./settings/skills/store"
import { WebviewModel } from "./settings/webview/store"
import { FileContextTrackerStoreModel } from "./foundation/time-machine/file-context/store"
import { setRootStore, getBackendRootStore } from "./storeSingleton"

// ─── Type guard for deserialized objects ────────────────────────────
function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value)
}

// ─── Action log entry type ──────────────────────────────────────────
export interface ActionLogEntry {
	name: string
	path: string
	args: unknown[]
	timestamp: number
}

// ─── Event log entry for debug visibility ──────────────────────────
export const EventLogModel = types.model("EventLog", {
	type: types.string,
	ts: types.number,
	direction: types.enumeration(["outgoing", "incoming"]),
	payload: types.frozen(),
})

export type IEventLog = Instance<typeof EventLogModel>

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
		settings: types
			.model("Settings", {
				apiConfig: ApiConfigModel,
				files: FilesModel,
				mcp: McpModel,
				models: ModelsModel,
				modes: ModesModel,
				prompts: PromptsModel,
				skills: SkillsModel,
				webview: WebviewModel,
				settingsImportedAt: types.number,
			})
			.actions((self) => ({
				setSettingsImportedAt(value: number) {
					self.settingsImportedAt = value
				},
			})),
		cloud: CloudModel,
		marketplace: MarketplaceModel,
		intentStore: types.optional(IntentStoreModel, () => ({
			intents: [],
		})),
		fileContextTracker: types.optional(FileContextTrackerStoreModel, () => ({
			entries: {},
		})),
		eventLog: types.array(EventLogModel),
	})
	.actions((self) => ({
		logEvent(event: { type: string; ts: number; direction: "outgoing" | "incoming"; payload: unknown }) {
			self.eventLog.push(event)
			if (self.eventLog.length > 1000) {
				self.eventLog.splice(0, self.eventLog.length - 1000)
			}
		},
	}))

export type IBackendRootStore = Instance<typeof BackendRootModel>
export type FeatureState = IBackendRootStore

// ─── Snapshot persistence key ───────────────────────────────────────
const SNAPSHOT_KEY = "jabberwock.backendRootStore.snapshot"

interface InitOptions {
	/** Optional VS Code ExtensionContext for HMR snapshot persistence */
	context?: { globalState: { get: (k: string) => unknown; update: (k: string, v: unknown) => Thenable<void> } }
}

// ─── Complete default snapshot (all required fields) ──────────────
function createDefaultSnapshot(): Record<string, unknown> {
	return {
		settings: {
			apiConfig: {
				id: "",
				currentConfigName: "",
				listApiConfigMeta: [],
				apiProvider: "",
				apiModelId: "",
				baseUrl: "",
				includeMaxTokens: false,
				todoListEnabled: false,
				modelTemperature: 0,
				rateLimitSeconds: 0,
				consecutiveMistakeLimit: 0,
				enableReasoningEffort: false,
				reasoningEffort: "",
				modelMaxTokens: 0,
				modelMaxThinkingTokens: 0,
				verbosity: 0,
				apiKey: "",
				providerSpecificFields: {},
			},

			commands: {},
			debug: {},
			files: {},
			mcp: {},
			models: {},
			modes: {},
			prompts: {},
			skills: { skillsManager: null },
			vscode: {},
			webview: {},
			worktree: {},
			settingsImportedAt: 0,
		},
		cloud: {},
		marketplace: {},
		history: {
			items: [],
			currentTaskId: "",
		},
		eventLog: [],
	}
}

/**
 * Deep‑merge a persisted snapshot over defaults so that any missing,
 * null, or undefined fields are filled with valid default values.
 * This handles HMR snapshots that may still carry null/undefined from
 * the old `types.maybe` schema.
 */
function deepMergeDefaults(
	defaults: Record<string, unknown>,
	overrides: Record<string, unknown>,
): Record<string, unknown> {
	const result: Record<string, unknown> = { ...overrides }
	for (const key of Object.keys(defaults)) {
		if (
			!Object.prototype.hasOwnProperty.call(overrides, key) ||
			overrides[key] === undefined ||
			overrides[key] === null
		) {
			// Missing, null, or undefined → use the default
			result[key] = defaults[key]
		} else {
			const dVal = defaults[key]
			const oVal = overrides[key]
			if (isRecord(dVal) && isRecord(oVal)) {
				// Both are plain objects → recurse
				result[key] = deepMergeDefaults(dVal, oVal)
			}
		}
	}
	return result
}

// ─── Singleton + onAction buffer ───────────────────────────────────
const _actionBuffer: ActionLogEntry[] = []

/** Singleton IntentBus — set by setupIntents(), used by extension.ts for handler registration. */
let _intentBus: IntentBus | null = null

/**
 * Get the singleton IntentBus for handler registration.
 *
 * Called from extension.ts after createBackendRootStore() to register
 * feature handlers on the bus.
 */
export function getIntentBus(): IntentBus | null {
	return _intentBus
}

export function createBackendRootStore(options?: InitOptions): IBackendRootStore {
	const rawSnapshot = options?.context?.globalState.get(SNAPSHOT_KEY)
	const defaultSnapshot = createDefaultSnapshot()
	const snapshot = isRecord(rawSnapshot) ? deepMergeDefaults(defaultSnapshot, rawSnapshot) : defaultSnapshot

	// Sanitize history items from persisted HMR snapshot — fields
	// may still be null/undefined from the old `types.maybe` schema.
	const historySnap: unknown = snapshot.history
	if (isRecord(historySnap) && Array.isArray(historySnap.items)) {
		const items: unknown[] = historySnap.items
		snapshot.history = {
			...historySnap,
			currentTaskId: typeof historySnap.currentTaskId === "string" ? historySnap.currentTaskId : "",
			items: items.map((raw: unknown) => {
				const item: Record<string, unknown> = isRecord(raw) ? raw : Object.create(null)
				return {
					...item,
					id: typeof item.id === "string" ? item.id : crypto.randomUUID(),
					task: typeof item.task === "string" ? item.task : "",
					ts: typeof item.ts === "number" ? item.ts : 0,
					tokensIn: typeof item.tokensIn === "number" ? item.tokensIn : 0,
					tokensOut: typeof item.tokensOut === "number" ? item.tokensOut : 0,
					cacheWrites: typeof item.cacheWrites === "number" ? item.cacheWrites : 0,
					cacheReads: typeof item.cacheReads === "number" ? item.cacheReads : 0,
					totalCost: typeof item.totalCost === "number" ? item.totalCost : 0,
					workspace: typeof item.workspace === "string" ? item.workspace : undefined,
					mode: typeof item.mode === "string" ? item.mode : undefined,
					status: typeof item.status === "string" ? item.status : undefined,
					parentTaskId: typeof item.parentTaskId === "string" ? item.parentTaskId : undefined,
					rootTaskId: typeof item.rootTaskId === "string" ? item.rootTaskId : undefined,
					childIds: Array.isArray(item.childIds)
						? item.childIds.filter((c: unknown): c is string => typeof c === "string")
						: [],
					number: typeof item.number === "number" ? item.number : undefined,
					size: typeof item.size === "number" ? item.size : undefined,
					apiConfigName: typeof item.apiConfigName === "string" ? item.apiConfigName : undefined,
				}
			}),
		}
	}

	// Sanitize persisted chat task entries — remove stale fields that no
	// longer exist on TaskModel (e.g. "messages" from old schema) to
	// prevent MST runtime errors ("subpath expected") during create().
	const chatSnap = isRecord(snapshot.chat) ? snapshot.chat : null
	if (chatSnap && isRecord(chatSnap.tasks)) {
		const sanitizedTasks: Record<string, unknown> = {}
		for (const [taskId, taskData] of Object.entries(chatSnap.tasks)) {
			if (!isRecord(taskData)) {
				sanitizedTasks[taskId] = taskData
				continue
			}
			// Strip fields not defined on TaskModel
			const { messages, ...cleanTask } = taskData
			sanitizedTasks[taskId] = cleanTask
		}
		chatSnap.tasks = sanitizedTasks
	}

	const rootStore = BackendRootModel.create(snapshot)

	// Register the root store in the module-level variable so getState() can
	// find it without a circular import (esbuild __esm safety).
	setRootStore(rootStore)

	// Wire up IntentBus dispatch reaction.
	// Feature handlers are registered separately in extension.ts via getIntentBus().
	const { bus, dispose: disposeBus } = setupIntents(rootStore)
	_intentBus = bus

	// Persist every snapshot change so HMR can restore state.
	if (options?.context) {
		onSnapshot(rootStore, (snap) => {
			void options.context!.globalState.update(SNAPSHOT_KEY, snap)
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
