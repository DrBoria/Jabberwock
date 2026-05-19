import { types, onAction, onSnapshot, Instance, getSnapshot, applySnapshot } from "mobx-state-tree"
import { ChatModel } from "./chat/store"
import { FoundationModel } from "./foundation/store"
import { HistoryModel } from "./history/store"
import { CloudModel } from "./cloud/store"
import { DiagnosticsModel } from "./diagnostics/store"
import { MarketplaceModel } from "./marketplace/store"
import { TelemetryModel } from "./telemetry/store"
import { CoreStateModel } from "./core/store"
import { ApiConfigModel } from "./settings/api-config/store"
import { CodeIndexModel } from "./settings/code-index/store"
import { CommandsModel } from "./settings/commands/store"
import { DebugModel } from "./settings/debug/store"
import { FilesModel } from "./settings/files/store"
import { McpModel } from "./settings/mcp/store"
import { ModelsModel } from "./settings/models/store"
import { ModesModel } from "./settings/modes/store"
import { PromptsModel } from "./settings/prompts/store"
import { SkillsModel } from "./settings/skills/store"
import { VscodeModel } from "./settings/vscode/store"
import { WebviewModel } from "./settings/webview/store"
import { WorktreeModel } from "./settings/worktree/store"
import { setRootStore, getBackendRootStore } from "./storeSingleton"

// ─── Action log entry type ──────────────────────────────────────────
export interface ActionLogEntry {
	name: string
	path: string
	args: unknown[]
	timestamp: number
}

// ─── Root Model ─────────────────────────────────────────────────────
export const BackendRootModel = types.model("BackendRoot", {
	chat: types.optional(ChatModel, () => ({
		ask: {},
		messagesList: {
			nodes: [],
			createBranch: "",
			switchContext: "",
		},
		notifications: {},
		task: {
			currentTask: "",
			taskStack: "",
			taskEventListeners: [],
			taskCreationCallback: "",
		},
		textArea: {},
		topic: {},
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
	settings: types.model("Settings", {
		apiConfig: ApiConfigModel,
		codeIndex: CodeIndexModel,
		commands: CommandsModel,
		debug: DebugModel,
		files: FilesModel,
		mcp: McpModel,
		models: ModelsModel,
		modes: ModesModel,
		prompts: PromptsModel,
		skills: SkillsModel,
		vscode: VscodeModel,
		webview: WebviewModel,
		worktree: WorktreeModel,
	}),
	core: CoreStateModel,
	cloud: CloudModel,
	diagnostics: DiagnosticsModel,
	marketplace: MarketplaceModel,
	telemetry: TelemetryModel,
})

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
			codeIndex: { codeIndexManager: null },
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
		},
		core: {
			cwd: "",
			latestAnnouncementId: "",
			settingsImportedAt: 0,
			proxyInitialized: false,
			undiciProxyInitialized: false,
			fetchPatched: false,
			cloudServiceAvailable: false,
			wsMcpPort: 0,
			diagnosticsIntercepting: false,
		},
		cloud: {},
		diagnostics: {},
		marketplace: {},
		history: {
			items: [],
			currentTaskId: "",
		},
		telemetry: {},
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
		} else if (
			typeof defaults[key] === "object" &&
			defaults[key] !== null &&
			!Array.isArray(defaults[key]) &&
			typeof overrides[key] === "object" &&
			overrides[key] !== null &&
			!Array.isArray(overrides[key])
		) {
			// Both are plain objects → recurse
			result[key] = deepMergeDefaults(
				defaults[key] as Record<string, unknown>,
				overrides[key] as Record<string, unknown>,
			)
		}
	}
	return result
}

// ─── Singleton + onAction buffer ───────────────────────────────────
const _actionBuffer: ActionLogEntry[] = []

export function createBackendRootStore(options?: InitOptions): IBackendRootStore {
	const rawSnapshot = options?.context?.globalState.get(SNAPSHOT_KEY)
	const defaultSnapshot = createDefaultSnapshot()
	const snapshot =
		rawSnapshot !== null && typeof rawSnapshot === "object"
			? deepMergeDefaults(defaultSnapshot, rawSnapshot as Record<string, unknown>)
			: defaultSnapshot

	// Sanitize history items from persisted HMR snapshot — numeric fields
	// may still be null/undefined from the old `types.maybe` schema.
	const historySnap = snapshot.history as Record<string, unknown> | undefined
	if (historySnap && Array.isArray(historySnap.items)) {
		snapshot.history = {
			...historySnap,
			currentTaskId: typeof historySnap.currentTaskId === "string" ? historySnap.currentTaskId : "",
			items: (historySnap.items as Record<string, unknown>[]).map((item: Record<string, unknown>) => ({
				...item,
				ts: typeof item.ts === "number" ? item.ts : 0,
				tokensIn: typeof item.tokensIn === "number" ? item.tokensIn : 0,
				tokensOut: typeof item.tokensOut === "number" ? item.tokensOut : 0,
				cacheWrites: typeof item.cacheWrites === "number" ? item.cacheWrites : 0,
				cacheReads: typeof item.cacheReads === "number" ? item.cacheReads : 0,
				totalCost: typeof item.totalCost === "number" ? item.totalCost : 0,
			})),
		}
	}

	const rootStore = BackendRootModel.create(snapshot)

	// Register the root store in the module-level variable so getState() can
	// find it without a circular import (esbuild __esm safety).
	setRootStore(rootStore)

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
