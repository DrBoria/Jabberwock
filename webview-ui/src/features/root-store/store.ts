import { types, Instance } from "mobx-state-tree"
import { vscode } from "@jabberwock/devtool/webview"
import type { WebviewMessage, ExtensionMessage, ExtensionState, Command } from "@jabberwock/types"
import { eventConstants } from "@jabberwock/types"

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

const postMsg = (msg: WebviewMessage) => vscode.postMessage(msg)

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
			const customModePrompts = { ...prevCustomModePrompts, ...newCustomModePrompts },
				experiments = { ...prevExperiments, ...newExperiments },
				rest = { ...prevRest, ...newRest }
			if (shouldProtectStaleMessages(newState.messagesSeq, prev.messagesSeq, newState.messages)) {
				rest.messages = prev.messages
				rest.messagesSeq = prev.messagesSeq
			}
			self.extensionState = {
				...rest,
				apiConfiguration: apiConfiguration || prev.apiConfiguration,
				customModePrompts,
				customSupportPrompts: customSupportPrompts || prev.customSupportPrompts,
				experiments,
			} as ExtensionState
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
		handleExtensionMessage(event: MessageEvent) {
			const message: ExtensionMessage = event.data
			if (handleDomAction(message, self.chat)) return
			if (handleStreamChunk(message)) return
			const intentType = handleExtensionMessageDispatchMap[message.type]
			if (intentType)
				self.intentStore.createIntent({
					id: crypto.randomUUID(),
					type: intentType,
					payload: { ...message } as Record<string, unknown>,
					createdAt: Date.now(),
				})
		},
		initMessageListener() {
			window.addEventListener("message", (event: MessageEvent) => this.handleExtensionMessage(event))
		},
	}))
	.actions((self) => ({
		...createExtensionSetters(self),
	}))

export type IRootStore = Instance<typeof RootStore>
