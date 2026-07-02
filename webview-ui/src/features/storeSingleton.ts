/**
 * Store singleton — holds the global RootStore instance and action buffer.
 *
 * The actual RootStore model definition lives in `./store.ts`.
 * This file provides the singleton factory functions and the module-level
 * lifetime management so the root store is created exactly once.
 */
import { onAction } from "mobx-state-tree"

import { defaultModeSlug, defaultPrompts } from "@shared/modes"
import { experimentDefault } from "@shared/experiments"

import { RootStore } from "./root-store"
import type { IRootStore } from "./root-store"

// ─── Action log entry type ──────────────────────────────────────────
export interface FrontendActionLogEntry {
	name: string
	path: string
	args: unknown[]
	timestamp: number
}

// ─── Singleton state ────────────────────────────────────────────────
let _rootStore: IRootStore | null = null
const _actionBuffer: FrontendActionLogEntry[] = []

// ─── Factory ────────────────────────────────────────────────────────
export function createRootStore(): IRootStore {
	if (_rootStore) return _rootStore

	_rootStore = RootStore.create({
		// ── Extension state (frozen blob from extension host) ──
		extensionState: {
			apiConfiguration: {},
			version: "",
			messages: [],
			taskHistory: [],
			shouldShowAnnouncement: false,
			allowedCommands: [],
			deniedCommands: [],
			soundEnabled: false,
			soundVolume: 0.5,
			ttsEnabled: false,
			ttsSpeed: 1.0,
			enableCheckpoints: true,
			checkpointTimeout: 15,
			language: "en",
			writeDelayMs: 1000,
			terminalShellIntegrationTimeout: 4000,
			terminalShellIntegrationDisabled: false,
			terminalOutputPreviewSize: "medium",
			terminalZdotdir: false,
			mcpEnabled: true,
			taskSyncEnabled: false,
			currentApiConfigName: "default",
			listApiConfigMeta: [],
			pinnedApiConfigs: {},
			mode: defaultModeSlug,
			customModePrompts: defaultPrompts,
			customSupportPrompts: {},
			experiments: experimentDefault,
			enhancementApiConfigId: "",
			hasOpenedModeSelector: false,
			autoApprovalEnabled: false,
			customModes: [],
			maxOpenTabsContext: 20,
			maxWorkspaceFiles: 200,
			cwd: "",
			telemetrySetting: "unset",
			showJabberwockIgnoredFiles: true,
			enableSubfolderRules: false,
			renderContext: "sidebar",
			maxReadFileLine: -1,
			maxImageFileSize: 5,
			maxTotalImageSize: 20,
			historyPreviewCollapsed: false,
			reasoningBlockCollapsed: true,
			enterBehavior: "send",
			autoCondenseContext: true,
			autoCondenseContextPercent: 100,
			profileThresholds: {},
			locatorTarget: "code",
			codebaseIndexConfig: {
				codebaseIndexEnabled: true,
				codebaseIndexQdrantUrl: "http://localhost:6333",
				codebaseIndexEmbedderProvider: "openai",
				codebaseIndexEmbedderBaseUrl: "",
				codebaseIndexEmbedderModelId: "",
				codebaseIndexSearchMaxResults: undefined,
				codebaseIndexSearchMinScore: undefined,
			},
			codebaseIndexModels: { ollama: {}, openai: {} },
			includeDiagnosticMessages: true,
			maxDiagnosticMessages: 50,
			openRouterImageApiKey: "",
			openRouterImageGenerationSelectedModel: "",
			includeCurrentTime: true,
			includeCurrentCost: true,
			lockApiConfigAcrossModes: false,
			devtoolEnabled: false,
			showWorktreesInHomeScreen: true,
			alwaysAllowReadOnly: false,
			alwaysAllowReadOnlyOutsideWorkspace: false,
			alwaysAllowWrite: false,
			alwaysAllowWriteOutsideWorkspace: false,
			alwaysAllowExecute: false,
			alwaysAllowMcp: false,
			alwaysAllowModeSwitch: false,
			alwaysAllowSubtasks: false,
			allowedMaxRequests: undefined,
			allowedMaxCost: undefined,
			customInstructions: undefined,
			systemPromptTemplates: {},
			organizationAllowList: { allowAll: true, providers: {} },
			organizationSettingsVersion: 0,
			cloudUserInfo: null,
			cloudIsAuthenticated: false,
			sharingEnabled: false,
			publicSharingEnabled: false,
		},

		// ── Root-level store properties ──
		didHydrateState: false,
		showWelcome: false,
		_welcomeDismissed: false,
		theme: {},
		filePaths: [],
		openedTabs: [],
		extensionCommands: [],
		interactiveAppUri: "",
		currentCheckpoint: "",

		// ── Sub-stores ──
		chat: {},
		settings: {
			activeTab: "",
			searchQuery: "",
			theme: {},
			fontSize: 14,
			mcpServers: [],
			routerModels: {
				openrouter: {},
				"vercel-ai-gateway": {},
				litellm: {},
				requesty: {},
				jabberwock: {},
				unbound: {},
				ollama: {},
				lmstudio: {},
			},
			profileThresholds: {},
			alwaysAllowFollowupQuestions: true,
			followupAutoApproveTimeoutMs: 30000,
			hasOpenedModeSelector: false,
			includeTaskHistoryInEnhance: true,
			includeCurrentTime: true,
			includeCurrentCost: true,
			organizationAllowList: { allowAll: true, providers: {} },
			organizationSettingsVersion: 0,
		},
		marketplace: {
			marketplaceInstalledMetadata: { project: {}, global: {} },
		},
		cloud: {
			cloudIsAuthenticated: false,
			cloudOrganizations: [],
			sharingEnabled: false,
			publicSharingEnabled: false,
			prevCloudIsAuthenticated: false,
		},
		history: {},
		windowManager: {
			activeWindows: [{ type: "chat" as const, props: {} }],
		},
	})

	onAction(_rootStore, (call: { name: string; path?: string; args?: unknown[] }) => {
		_actionBuffer.push({
			name: call.name,
			path: call.path ?? "",
			args: call.args ?? [],
			timestamp: Date.now(),
		})
		if (_actionBuffer.length > 500) _actionBuffer.shift()
	})

	return _rootStore
}

export function getRootStore(): IRootStore {
	if (!_rootStore) throw new Error("RootStore not initialized. Call createRootStore() first.")
	return _rootStore
}

export function getFrontendActionBuffer(): FrontendActionLogEntry[] {
	return _actionBuffer
}

// Backward-compatible singleton reference (initialized lazily)
export const rootStore = createRootStore()
