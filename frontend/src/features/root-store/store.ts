import { types, Instance } from "mobx-state-tree"
import type {
	WebviewMessage,
	ExtensionMessage,
	ExtensionState,
	Command,
	ModeConfig,
	InboundAppMessage,
	IConnectorEventBus,
	DisposableLike,
} from "@jabberwock/types"
import { getConnectorBus } from "../../connector-bus"
import { eventConstants, DEFAULT_MODES } from "@jabberwock/types"

import { extStateDefaults } from "./defaults"
import {
	logIncomingMessages,
	shouldProtectStaleMessages,
	handleDomAction,
	handleStreamChunk,
	handleExtensionMessageDispatchMap,
} from "./helpers"
import { createExtensionSetters } from "./setters"
import type { WindowWithDevtool } from "./types"
import { ChatStore } from "../chat/store"
import { SettingsStore } from "../settings/settings-store"
import { MarketplaceStore } from "../marketplace/store"
import { CloudStore } from "../cloud/store"
import { TaskHistoryStore } from "../history/store"
import { WindowManagerStore } from "../foundation/window-manager/store"
import { IntentStoreModel } from "../intents"
import { McpExecutionStore } from "../chat/mcp/store"
import { SkillsStore } from "../settings/skills/store"
import { AgentStateStore } from "../settings/agents/store"

const postMsg = (msg: WebviewMessage) => getConnectorBus().publish(msg)

/**
 * When the task is cancelled (isRunning transitions true→false),
 * finalize the last partial message so isStreaming is recomputed correctly.
 * Without this, computeIsStreaming sees partial===true and keeps isStreaming=true,
 * preventing the Stop→Send button toggle and chat input unlock.
 */
/**
 * If the last api_req_started notification has no cost and no cancelReason,
 * inject cancelReason:"user_cancelled" so hasOrphanApiRequest() returns false
 * and computeIsStreaming doesn't keep isStreaming=true on cancel.
 */
function finalizeOrphanApiReqs<T extends { text?: string }>(messages: T[]): boolean {
	const lastApiReqIndex = [...messages]
		.reverse()
		.findIndex((m) => (m as Record<string, unknown>).say === "api_req_started")
	if (lastApiReqIndex === -1) return false

	const idx = messages.length - 1 - lastApiReqIndex
	const msg = messages[idx]
	if (!msg?.text) return false

	try {
		const parsed = JSON.parse(msg.text) as { cost?: number; cancelReason?: string }
		if (parsed.cost !== undefined || parsed.cancelReason !== undefined) return false

		messages[idx] = { ...msg, text: JSON.stringify({ ...parsed, cancelReason: "user_cancelled" }) } as T
		return true
	} catch {
		return false
	}
}

function finalizePartialOnCancel<T extends { partial?: boolean }>(
	newState: { isRunning?: boolean },
	_prev: { isRunning?: boolean },
	messages: T[] | undefined,
): T[] {
	if (!(newState.isRunning === false && messages?.length)) return messages ?? ([] as T[])

	const newMessages = [...messages]
	let modified = false

	// Finalize last partial message
	const lastMessage = newMessages[newMessages.length - 1] as Record<string, unknown>
	if (lastMessage.partial === true) {
		newMessages[newMessages.length - 1] = { ...lastMessage, partial: false } as T
		modified = true
	}

	// Finalize orphan API requests so hasOrphanApiRequest() doesn't
	// keep isStreaming=true after the user cancels during tool phase
	// when no API stream was actively running (so updateApiReqMsg
	// never ran on the backend).
	if (finalizeOrphanApiReqs(newMessages as { text?: string }[])) {
		modified = true
	}

	return modified ? newMessages : (messages ?? ([] as T[]))
}

export const RootStore = types
	.model("RootStore", {
		extensionState: types.optional(types.frozen<ExtensionState>(), () => extStateDefaults as ExtensionState),
		didHydrateState: types.boolean,
		showWelcome: types.boolean,
		_welcomeDismissed: types.boolean,
		theme: types.frozen(),
		filePaths: types.frozen<string[]>(),
		openedTabs: types.frozen<Array<{ label: string; isActive: boolean; path?: string }>>(),
		extensionCommands: types.frozen<Command[]>(),
		interactiveAppUri: types.string,
		currentCheckpoint: types.string,
		chat: types.optional(ChatStore, () => ChatStore.create({})),
		settings: types.optional(SettingsStore, () =>
			SettingsStore.create({
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
			}),
		),
		marketplace: types.optional(MarketplaceStore, () =>
			MarketplaceStore.create({ marketplaceInstalledMetadata: { project: {}, global: {} } }),
		),
		cloud: types.optional(CloudStore, () =>
			CloudStore.create({
				cloudIsAuthenticated: false,
				cloudOrganizations: [],
				sharingEnabled: false,
				publicSharingEnabled: false,
				prevCloudIsAuthenticated: false,
			}),
		),
		history: types.optional(TaskHistoryStore, () => TaskHistoryStore.create({ items: [] })),
		windowManager: types.optional(WindowManagerStore, () =>
			WindowManagerStore.create({ activeWindows: [{ type: "chat", props: {} }] }),
		),
		mcpExecution: types.optional(McpExecutionStore, () => McpExecutionStore.create({})),
		skills: types.optional(SkillsStore, () => SkillsStore.create({})),
		agentState: types.optional(AgentStateStore, () => AgentStateStore.create({})),
		intentStore: types.optional(IntentStoreModel, () => IntentStoreModel.create({})),
	})
	.actions((self) => ({
		mergeExtensionState(newState: Partial<ExtensionState>) {
			const prev = self.extensionState
			logIncomingMessages(newState.messages)
			const { customModePrompts: prevCustomModePrompts, experiments: prevExperiments, ...prevRest } = prev
			const {
				apiConfiguration,
				customModePrompts: newCustomModePrompts = {},
				customSupportPrompts,
				experiments: newExperiments = {},
				...newRest
			} = newState
			const customModePrompts = { ...prevCustomModePrompts, ...newCustomModePrompts }
			const experiments = { ...prevExperiments, ...newExperiments }
			const rest = { ...prevRest, ...newRest }

			if (shouldProtectStaleMessages(newState.messagesSeq, prev.messagesSeq, newState.messages)) {
				rest.messages = prev.messages
				rest.messagesSeq = prev.messagesSeq
			}

			rest.messages = finalizePartialOnCancel(newState, prev, rest.messages)

			self.extensionState = {
				...rest,
				apiConfiguration: apiConfiguration || prev.apiConfiguration,
				customModePrompts,
				customSupportPrompts: customSupportPrompts || prev.customSupportPrompts,
				experiments,
			} as ExtensionState

			// Hydrate agentState.modeSelector from extensionState
			// (modeSelector is registered with MstBridge but never receives snapshots)
			const mode = self.extensionState.mode
			const customModes = (self.extensionState.customModes ?? []) as ModeConfig[]
			const allModes = [...DEFAULT_MODES, ...customModes]
			self.agentState.modeSelector.setCurrentMode(mode)
			self.agentState.modeSelector.setAllModes(allModes as Record<string, unknown>[])
			self.agentState.modeSelector.setCustomModes(customModes as Record<string, unknown>[])
		},
		updateDevtoolState() {
			if (self.extensionState.devtoolEnabled)
				(window as WindowWithDevtool).__JABBERWOCK_GET_STATE__ = () => ({ ...self.extensionState })
			else delete (window as WindowWithDevtool).__JABBERWOCK_GET_STATE__
		},
		checkCloudAuthChange() {
			const ca = self.cloud.cloudIsAuthenticated ?? false
			const cp = self.extensionState.apiConfiguration?.apiProvider
			if (!self.cloud.prevCloudIsAuthenticated && ca && cp === "jabberwock")
				postMsg({ type: eventConstants.AGENT_STATE.REQUEST_ROUTER_MODELS } satisfies WebviewMessage)
			self.cloud.setPrevCloudIsAuthenticated(ca)
		},
		handleExtensionMessage(message: InboundAppMessage) {
			// Host and DOM-local messages share the single bus channel; the helpers
			// below discriminate by type/action. Streaming frames keep their
			// high-frequency exception path (plan §4.5 lines 494-495).
			const extMessage = message as ExtensionMessage
			if (handleDomAction(extMessage, self.chat)) return
			if (handleStreamChunk(extMessage, self.chat)) return
			const intentType = handleExtensionMessageDispatchMap[extMessage.type]
			if (intentType)
				self.intentStore.createIntent({
					id: crypto.randomUUID(),
					type: intentType,
					payload: { ...extMessage } as Record<string, unknown>,
					createdAt: Date.now(),
				})
		},
		initMessageListener(bus: IConnectorEventBus): DisposableLike {
			// Subscribe the root-store handler through the connector bus instead of
			// adding a raw window "message" listener (plan §4.5). Returns a
			// disposable so the caller (App.tsx) can unsubscribe on unmount.
			return bus.subscribe({}, (msg) => this.handleExtensionMessage(msg))
		},
		/**
		 * Run a function inside this RootStore's MST action context.
		 * Allows handlers to modify RootStore properties safely.
		 */
		runHandler<T>(fn: () => T): T {
			return fn()
		},
	}))
	.actions((self) => ({
		...createExtensionSetters(self),
	}))

export type IRootStore = Instance<typeof RootStore>
