import { vscode } from "@jabberwock/devtool/react"
import type {
	ExtensionMessage,
	ClineMessage,
	HistoryItem,
	ExtensionState,
	Command,
	RouterModels,
	MarketplaceItem,
	MarketplaceInstalledMetadata,
	SkillMetadata,
	McpServer,
} from "@jabberwock/types"
import { AGENT_STATE_AUTO_APPROVAL_ENABLED } from "@jabberwock/types"
import { findLastIndex } from "@shared/array"
import { checkExistKey } from "@shared/checkExistApiConfig"
import { convertTextMateToHljs } from "@src/utils/convertTextMateToHljs"

// ── ChatStore-compatible action factory (to be spread into ChatStore's .actions()) ──

interface MessageHandlerSelf {
	interactiveAppUri?: string
	mergeExtensionState(newState: Partial<ExtensionState>): void
	_welcomeDismissed: boolean
	showWelcome: boolean
	didHydrateState: boolean
	alwaysAllowFollowupQuestions: boolean
	followupAutoApproveTimeoutMs: number
	includeTaskHistoryInEnhance: boolean
	includeCurrentTime: boolean
	includeCurrentCost: boolean
	extensionState: ExtensionState
	theme: unknown
	filePaths: string[]
	openedTabs: Array<{ label: string; isActive: boolean; path?: string }>
	extensionCommands: Command[]
	skills?: SkillMetadata[]
	mcpServers?: McpServer[]
	currentCheckpoint?: string
	routerModels?: RouterModels
	marketplaceItems?: MarketplaceItem[]
	marketplaceInstalledMetadata?: MarketplaceInstalledMetadata
	prevCloudIsAuthenticated?: boolean
	cloudIsAuthenticated?: boolean
	ui: {
		clearInput(): void
		setSendingDisabled(val: boolean): void
		inputValue: string
		setInputValue(val: string): void
		appendSelectedImages(images: string[]): void
		isCondensing: boolean
		sendingDisabled: boolean
		setIsCondensing(val: boolean): void
		setCheckpointWarning(val: unknown): void
		enableButtons: boolean
		updateAggregatedCosts(key: string, val: { totalCost: number; ownCost: number; childrenCost: number }): void
	}
	sendMessage(text: string, images: string[]): void
	handlePrimaryButtonClick(
		clineAsk: string | undefined,
		currentTaskItem: { parentTaskId?: string } | undefined,
		messages: ClineMessage[],
		text?: string,
		images?: string[],
	): void
	handleSecondaryButtonClick(
		clineAsk: string | undefined,
		isStreaming: boolean,
		text?: string,
		images?: string[],
	): void
	elicitResponse(values: Record<string, unknown>): void
	clearTask(): void
}

export function createMessageHandlerActions(self: MessageHandlerSelf) {
	return {
		handleExtensionMessage(event: MessageEvent) {
			const message: ExtensionMessage = event.data
			switch (message.type) {
				case "showInteractiveApp": {
					self.interactiveAppUri = message.uri ?? ""
					break
				}
				case "state": {
					const newState = message.state ?? {}
					const hasApiConfig = "apiConfiguration" in newState
					self.mergeExtensionState(newState)
					if (!self._welcomeDismissed && hasApiConfig) {
						const showWelcomeValue = !checkExistKey(newState.apiConfiguration)
						self.showWelcome = showWelcomeValue
					}
					self.didHydrateState = true
					if (newState.alwaysAllowFollowupQuestions !== undefined) {
						self.alwaysAllowFollowupQuestions = newState.alwaysAllowFollowupQuestions
					}
					if (newState.followupAutoApproveTimeoutMs !== undefined) {
						self.followupAutoApproveTimeoutMs = newState.followupAutoApproveTimeoutMs
					}
					if (newState.includeTaskHistoryInEnhance !== undefined) {
						self.includeTaskHistoryInEnhance = newState.includeTaskHistoryInEnhance
					}
					if (newState.includeCurrentTime !== undefined) {
						self.includeCurrentTime = newState.includeCurrentTime
					}
					if (newState.includeCurrentCost !== undefined) {
						self.includeCurrentCost = newState.includeCurrentCost
					}
					if (newState.locatorTarget !== undefined) {
						self.extensionState = { ...self.extensionState, locatorTarget: newState.locatorTarget }
					}
					if (newState.marketplaceItems !== undefined) {
						self.marketplaceItems = newState.marketplaceItems
					}
					if (newState.marketplaceInstalledMetadata !== undefined) {
						self.marketplaceInstalledMetadata =
							newState.marketplaceInstalledMetadata as MarketplaceInstalledMetadata
					}
					break
				}
				case "action": {
					if (message.action === "toggleAutoApprove") {
						const newValue = !(self.extensionState.autoApprovalEnabled ?? false)
						self.extensionState = { ...self.extensionState, autoApprovalEnabled: newValue }
						vscode.postMessage({ type: AGENT_STATE_AUTO_APPROVAL_ENABLED, bool: newValue })
					} else if (message.action === "didBecomeVisible") {
						if (!self.ui.sendingDisabled && !self.ui.enableButtons) {
							document.querySelector<HTMLTextAreaElement>("textarea")?.focus()
						}
					} else if (message.action === "focusInput") {
						document.querySelector<HTMLTextAreaElement>("textarea")?.focus()
					}
					break
				}
				case "theme": {
					if (message.text) {
						self.theme = convertTextMateToHljs(JSON.parse(message.text))
					}
					break
				}
				case "workspaceUpdated": {
					const paths = message.filePaths ?? []
					const tabs = message.openedTabs ?? []
					const uri = message.uri
					self.filePaths = paths
					self.openedTabs = tabs as Array<{ label: string; isActive: boolean; path?: string }>
					if (uri) {
						self.extensionState = { ...self.extensionState, cwd: uri }
					}
					break
				}
				case "commands": {
					self.extensionCommands = message.commands ?? []
					break
				}
				case "messageUpdated": {
					const clineMessage = message.clineMessage!
					const currentMessages = self.extensionState.clineMessages
					const lastIndex = findLastIndex(currentMessages, (msg: ClineMessage) => msg.ts === clineMessage.ts)
					let newMessages: ClineMessage[]
					if (lastIndex !== -1) {
						newMessages = [...currentMessages]
						newMessages[lastIndex] = clineMessage
					} else {
						newMessages = [...currentMessages, clineMessage]
					}
					self.extensionState = { ...self.extensionState, clineMessages: newMessages }
					break
				}
				case "skills": {
					if (message.skills) {
						self.skills = message.skills
					}
					break
				}
				case "mcpServers": {
					self.mcpServers = message.mcpServers ?? []
					break
				}
				case "currentCheckpointUpdated": {
					self.currentCheckpoint = message.text ?? ""
					break
				}
				case "listApiConfig": {
					self.extensionState = { ...self.extensionState, listApiConfigMeta: message.listApiConfig ?? [] }
					break
				}
				case "routerModels": {
					self.routerModels = message.routerModels
					break
				}
				case "marketplaceData": {
					if (message.marketplaceItems !== undefined) {
						self.marketplaceItems = message.marketplaceItems
					}
					if (message.marketplaceInstalledMetadata !== undefined) {
						self.marketplaceInstalledMetadata = message.marketplaceInstalledMetadata
					}
					break
				}
				case "taskHistoryUpdated": {
					if (message.taskHistory !== undefined) {
						self.extensionState = { ...self.extensionState, taskHistory: message.taskHistory }
					}
					break
				}
				case "taskHistoryItemUpdated": {
					const item = message.historyItem
					if (!item) break
					const currentHistory = self.extensionState.taskHistory
					const existingIndex = currentHistory.findIndex((h: HistoryItem) => h.id === item.id)
					let nextHistory: HistoryItem[]
					if (existingIndex === -1) {
						nextHistory = [item, ...currentHistory]
					} else {
						nextHistory = [...currentHistory]
						nextHistory[existingIndex] = item
					}
					nextHistory.sort((a: HistoryItem, b: HistoryItem) => b.ts - a.ts)
					const currentTaskItem =
						!self.extensionState.currentTaskItem || self.extensionState.currentTaskItem.id === item.id
							? item
							: self.extensionState.currentTaskItem
					self.extensionState = { ...self.extensionState, taskHistory: nextHistory, currentTaskItem }
					break
				}
				case "diagnostics": {
					if (message.diagnostics) {
						self.extensionState = { ...self.extensionState, diagnostics: message.diagnostics }
					}
					break
				}

				// ── Event-dispatch merged cases (from deleted event-dispatch.ts) ──
				case "invoke": {
					const invoke = message.invoke
					if (invoke === "newChat") {
						self.ui.clearInput()
						self.ui.setSendingDisabled(false)
					} else if (invoke === "sendMessage") {
						self.sendMessage(message.text ?? "", message.images ?? [])
					} else if (invoke === "setChatBoxMessage") {
						self.ui.setInputValue(
							self.ui.inputValue !== ""
								? self.ui.inputValue + " " + (message.text ?? "")
								: (message.text ?? ""),
						)
						self.ui.appendSelectedImages(message.images ?? [])
					} else if (invoke === "primaryButtonClick") {
						self.handlePrimaryButtonClick(
							undefined,
							undefined,
							[],
							message.text ?? "",
							message.images ?? [],
						)
					} else if (invoke === "secondaryButtonClick") {
						self.handleSecondaryButtonClick(undefined, false, message.text ?? "", message.images ?? [])
					} else if (invoke === "approveTodoPlan") {
						if (message.values) {
							self.elicitResponse(message.values)
						} else {
							document
								.querySelectorAll("iframe")
								.forEach((iframe) =>
									iframe.contentWindow?.postMessage({ type: "mcp-force-accept" }, "*"),
								)
						}
					}
					break
				}
				case "selectedImages": {
					if (message.context !== "edit" && message.images) {
						self.ui.appendSelectedImages(message.images.slice(0, 20))
					}
					break
				}
				case "condenseTaskContextStarted": {
					if (message.text) self.ui.setIsCondensing(true)
					break
				}
				case "condenseTaskContextResponse": {
					if (message.text) {
						if (self.ui.isCondensing && self.ui.sendingDisabled) self.ui.setSendingDisabled(false)
						self.ui.setIsCondensing(false)
					}
					break
				}
				case "checkpointInitWarning": {
					self.ui.setCheckpointWarning(message.checkpointWarning ?? undefined)
					break
				}
				case "interactionRequired": {
					break
				}
				case "taskWithAggregatedCosts": {
					if (message.text && message.aggregatedCosts) {
						self.ui.updateAggregatedCosts(message.text, message.aggregatedCosts)
					}
					break
				}
			}
		},
	}
}
