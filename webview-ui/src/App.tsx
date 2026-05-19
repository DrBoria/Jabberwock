import React, { useCallback, useEffect, useRef, useState, useMemo } from "react"
import { useEvent } from "react-use"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { type ExtensionMessage, type WebviewMessage, TelemetryEventName } from "@jabberwock/types"

import { MarketplaceViewStateManager } from "./components/marketplace/MarketplaceViewStateManager"

import { observer } from "mobx-react-lite"
import { vscode } from "@jabberwock/devtool/react"
import { createDomMessageHandler } from "@jabberwock/devtool/react"
import { telemetryClient } from "./features/cloud/utils/TelemetryClient"
import { initializeSourceMaps, exposeSourceMapsForDebugging } from "@jabberwock/devtool/react"
import { useExtensionState } from "./context/ExtensionStateContext"
import { type WindowTypeValue } from "./features/foundation/window-manager/store"
import { WindowLayer } from "./features/foundation/window-manager/window-layer"

import ChatView, { ChatViewRef } from "./features/chat/messages-list/view"
import { rootStore, RootStoreContext, createRootStore } from "./features/store"
import HistoryView from "./components/history/HistoryView"
import SettingsView, { SettingsViewRef } from "./components/settings/SettingsView"
import WelcomeView from "./components/welcome/WelcomeViewProvider"
import { MarketplaceView } from "./components/marketplace/MarketplaceView"
import { CheckpointRestoreDialog } from "./features/chat/notifications/checkpoint/checkpoint-restore-dialog"
import {
	DeleteMessageDialog,
	EditMessageDialog,
} from "./features/chat/notifications/message-modification-confirmation-dialog"
import ErrorBoundary from "./components/ErrorBoundary"
import { CloudView } from "./components/cloud/CloudView"
import { useAddNonInteractiveClickListener } from "./components/ui/hooks/useNonInteractiveClick"
import { TooltipProvider } from "./components/ui/tooltip"
import { STANDARD_TOOLTIP_DELAY } from "./components/ui/standard-tooltip"
import { McpIframeRenderer } from "./features/settings/mcp/McpIframeRenderer"
import { getAllModes } from "@shared/modes"
import { LocatorBridge } from "@jabberwock/devtool/react"
import { ChatTreeViewer } from "./features/chat/messages-list/sidebar"
import { chatTreeStore } from "./features/chat/messages-list/store"

interface DeleteMessageDialogState {
	isOpen: boolean
	messageTs: number
	hasCheckpoint: boolean
}

interface EditMessageDialogState {
	isOpen: boolean
	messageTs: number
	text: string
	hasCheckpoint: boolean
	images?: string[]
}

const MemoizedDeleteMessageDialog = React.memo(DeleteMessageDialog)
const MemoizedEditMessageDialog = React.memo(EditMessageDialog)
const MemoizedCheckpointRestoreDialog = React.memo(CheckpointRestoreDialog)

const tabsByMessageAction: Partial<Record<NonNullable<ExtensionMessage["action"]>, WindowTypeValue>> = {
	chatButtonClicked: "chat",
	settingsButtonClicked: "settings",
	historyButtonClicked: "history",
	marketplaceButtonClicked: "marketplace",
	cloudButtonClicked: "cloud",
}

const AppContent = observer(() => {
	const appRenderCount = React.useRef(0)
	appRenderCount.current++
	console.log(`[DEBUG:APP] AppContent RENDER #${appRenderCount.current}`)
	const {
		didHydrateState,
		showWelcome,
		shouldShowAnnouncement,
		telemetrySetting,
		telemetryKey,
		machineId,
		cloudUserInfo,
		cloudIsAuthenticated,
		cloudApiUrl,
		cloudOrganizations,
		renderContext,
		mdmCompliant,
		interactiveAppUri,
		setInteractiveAppUri,
		customModes,
	} = useExtensionState()

	const wm = rootStore.windowManager
	console.log(`[DEBUG:APP] AppContent windows=[${wm.activeWindows.map((w: { type: string }) => w.type).join(",")}]`)

	const marketplaceStateManager = useMemo(() => new MarketplaceViewStateManager(), [])

	const [showAnnouncement, setShowAnnouncement] = useState(false)

	const [deleteMessageDialogState, setDeleteMessageDialogState] = useState<DeleteMessageDialogState>({
		isOpen: false,
		messageTs: 0,
		hasCheckpoint: false,
	})

	const [editMessageDialogState, setEditMessageDialogState] = useState<EditMessageDialogState>({
		isOpen: false,
		messageTs: 0,
		text: "",
		hasCheckpoint: false,
		images: [],
	})

	const settingsRef = useRef<SettingsViewRef>(null)
	const chatViewRef = useRef<ChatViewRef>(null)

	const switchTab = useCallback(
		(newTab: WindowTypeValue, props?: Record<string, unknown>) => {
			console.log(`[App] switchTab requested: ${newTab}`, props)
			if (mdmCompliant === false && newTab !== "cloud") {
				console.warn(`[App] switchTab BLOCKED by mdmCompliant === false`)
				rootStore.chat.showMdmAuthNotification()
				return
			}

			const doSwitch = () => {
				console.log(`[App] Executing doSwitch to ${newTab}`, props)
				if (newTab === "chat") {
					if (props?.targetNodeId) {
						// Child task: push a new chat window on top of the stack
						wm.pushWindow("chat", { targetNodeId: props.targetNodeId })
					} else {
						wm.switchToBaseWindow("chat")
					}
				} else {
					wm.pushWindow(newTab, props)
				}
			}

			// Only check unsaved changes when switching AWAY from settings, not when entering settings
			const currentTop = wm.activeWindows[wm.activeWindows.length - 1]
			if (currentTop?.type === "settings" && settingsRef.current?.checkUnsaveChanges) {
				console.log(`[App] Checking unsaved changes before leaving settings`)
				settingsRef.current.checkUnsaveChanges(doSwitch)
			} else {
				doSwitch()
			}
		},
		[mdmCompliant, wm],
	)

	const onMessage = useCallback(
		(e: MessageEvent) => {
			const message: ExtensionMessage = e.data

			if (message.type === "action" && message.action) {
				console.log(`[App] Received action message: ${message.action}`, message)
				// Prevent infinite loops by ignoring switchTab messages that came from MCP
				if (message.action === "switchTab" && message.tab && !message.fromMCP) {
					const targetTab = message.tab as WindowTypeValue
					const targetSection = message.values?.section as string | undefined
					const targetNodeId = message.values?.targetNodeId as string | undefined
					switchTab(targetTab, { section: targetSection, targetNodeId })
				} else if (message.action === "switchTab" && message.tab && message.fromMCP) {
					// MCP-originated switchTab messages are already handled, do nothing
					console.log("[App] Ignoring MCP-originated switchTab to prevent loop")
				} else {
					const newTab = tabsByMessageAction[message.action]
					console.log(`[App] Mapping action ${message.action} to tab ${newTab}`)
					if (newTab) {
						const section = message.values?.section as string | undefined
						const marketplaceTab = message.values?.marketplaceTab as string | undefined
						const targetNodeId = message.values?.targetNodeId as string | undefined
						switchTab(newTab, { section, marketplaceTab, targetNodeId })
					}

					// If the message has a requestId, respond with the active page after navigation
					const requestId = message.requestId
					if (requestId) {
						const topWindow = wm.activeWindows[wm.activeWindows.length - 1]
						const mstPage = topWindow?.type || "chat"
						rootStore.windowManager.respondWithActivePage(requestId, mstPage)
					}
				}
			}

			if (message.type === "showDeleteMessageDialog" && message.messageTs) {
				setDeleteMessageDialogState({
					isOpen: true,
					messageTs: message.messageTs,
					hasCheckpoint: message.hasCheckpoint || false,
				})
			}

			if (message.type === "showEditMessageDialog" && message.messageTs && message.text) {
				setEditMessageDialogState({
					isOpen: true,
					messageTs: message.messageTs,
					text: message.text,
					hasCheckpoint: message.hasCheckpoint || false,
					images: message.images || [],
				})
			}

			if (message.type === "acceptInput") {
				chatViewRef.current?.acceptInput()
			}

			// Note: getActivePage, findElement, clickElement, typeText,
			// scrollElement, selectOption, getScreenshot, dragElement, and dragFromTo
			// are handled by <DevtoolProvider> which wraps the app.
		},
		[switchTab, wm],
	)

	useEvent("message", onMessage)

	// ── Store Query Handler (devtool MCP store inspection) ──────────
	// Handles getStoreSnapshot, getStoreActions, filterStoreActions, etc.
	// Separate from DevtoolProvider's DOM handler because store queries
	// need access to rootStore which lives in this module.
	useEffect(() => {
		// ── Helper: resolve store by name from rootStore ────────────────
		function resolveStoreByName(name: string): { store: unknown; label: string } | null {
			switch (name) {
				case "rootStore":
					return { store: rootStore, label: "rootStore" }
				case "chat":
					return { store: rootStore.chat, label: "chat" }
				case "settings":
					return { store: rootStore.settings, label: "settings" }
				case "marketplace":
					return { store: rootStore.marketplace, label: "marketplace" }
				case "cloud":
					return { store: rootStore.cloud, label: "cloud" }
				case "history":
					return { store: rootStore.history, label: "history" }
				case "windowManager":
					return { store: rootStore.windowManager, label: "windowManager" }
				case "extensionState":
					return { store: rootStore.extensionState, label: "extensionState" }
				default:
					return null
			}
		}

		// ── Helper: paginate an array ──────────────────────────────────
		function paginateArray<T>(items: T[], cursor: number, limit: number) {
			const page = items.slice(cursor, cursor + limit)
			return {
				items: page,
				cursor: cursor + limit,
				countLeft: Math.max(0, items.length - cursor - limit),
				prevCount: cursor,
				total: items.length,
			}
		}

		// ── Helper: get available action names from an MST store ───────
		function getActionNames(store: unknown): string[] {
			if (store === null || store === undefined) return []
			const names = new Set<string>()
			let proto = Object.getPrototypeOf(store)
			while (proto && proto !== Object.prototype) {
				const descriptors = Object.getOwnPropertyDescriptors(proto)
				for (const [key, desc] of Object.entries(descriptors)) {
					if (key.startsWith("_") || key === "constructor") continue
					if (typeof desc.value === "function" && !key.startsWith("$")) {
						names.add(key)
					}
				}
				proto = Object.getPrototypeOf(proto)
			}
			return Array.from(names).sort()
		}

		// ── Main store action handler ──────────────────────────────────
		async function handleStoreAction(message: Record<string, unknown>): Promise<void> {
			const action = message.action as string
			const requestId = message.requestId as string
			const storeName = (message.store as string) || "rootStore"
			const limit = (message.limit as number) || 10
			const cursor = (message.cursor as number) || 0

			const resolved = resolveStoreByName(storeName)
			if (!resolved) {
				vscode.postMessage({
					type: "domResponse",
					requestId,
					text: JSON.stringify({
						error: `Unknown store '${storeName}'. Available: rootStore, chat, settings, marketplace, cloud, history, windowManager, extensionState`,
					}),
				})
				return
			}

			switch (action) {
				case "getStoreSnapshot":
				case "filterStoreState": {
					const { getSnapshot } = await import("mobx-state-tree")
					const snapshot = getSnapshot(resolved.store as never) as Record<string, unknown>
					const pathFilter =
						action === "filterStoreState" ? (message.path as string) : (message.path as string | undefined)

					if (pathFilter) {
						const parts = pathFilter.split(".")
						let value: unknown = snapshot
						for (const part of parts) {
							if (value && typeof value === "object" && part in (value as Record<string, unknown>)) {
								value = (value as Record<string, unknown>)[part]
							} else {
								vscode.postMessage({
									type: "domResponse",
									requestId,
									text: JSON.stringify({ error: `Path '${pathFilter}' not found at '${part}'` }),
								})
								return
							}
						}
						if (value && typeof value === "object" && !Array.isArray(value)) {
							const entries = Object.entries(value as Record<string, unknown>)
							const result = paginateArray(
								entries.map(([k, v]) => ({ key: k, value: v })),
								cursor,
								limit,
							)
							vscode.postMessage({ type: "domResponse", requestId, text: JSON.stringify(result) })
						} else {
							vscode.postMessage({
								type: "domResponse",
								requestId,
								text: JSON.stringify({
									items: [{ path: pathFilter, value }],
									cursor: 1,
									countLeft: 0,
									prevCount: 0,
									total: 1,
								}),
							})
						}
						return
					}

					const entries = Object.entries(snapshot)
					const result = paginateArray(
						entries.map(([k, v]) => ({ key: k, value: v })),
						cursor,
						limit,
					)
					vscode.postMessage({ type: "domResponse", requestId, text: JSON.stringify(result) })
					break
				}

				case "getStoreActions": {
					const actionNames = getActionNames(resolved.store)
					const result = paginateArray(
						actionNames.map((name) => ({ name })),
						cursor,
						limit,
					)
					vscode.postMessage({ type: "domResponse", requestId, text: JSON.stringify(result) })
					break
				}

				case "filterStoreActions": {
					const pattern = ((message.pattern as string) || "").toLowerCase()
					const allActions = getActionNames(resolved.store)
					const filtered = allActions.filter((name) => name.toLowerCase().includes(pattern))
					const result = paginateArray(
						filtered.map((name) => ({ name })),
						cursor,
						limit,
					)
					vscode.postMessage({ type: "domResponse", requestId, text: JSON.stringify(result) })
					break
				}

				case "searchStoreActions": {
					const query = ((message.query as string) || "").toLowerCase()
					const allActions = getActionNames(resolved.store)
					const matched = allActions.filter((name) => name.toLowerCase().includes(query))
					const result = paginateArray(
						matched.map((name) => ({ name })),
						cursor,
						limit,
					)
					vscode.postMessage({ type: "domResponse", requestId, text: JSON.stringify(result) })
					break
				}

				case "countStoreActions": {
					const actionNames = getActionNames(resolved.store)
					vscode.postMessage({
						type: "domResponse",
						requestId,
						text: JSON.stringify({ store: storeName, count: actionNames.length }),
					})
					break
				}

				case "applyStoreSnapshot": {
					const { applySnapshot } = await import("mobx-state-tree")
					const snapshot = message.snapshot as Record<string, unknown>
					if (snapshot) {
						applySnapshot(resolved.store as never, snapshot)
						vscode.postMessage({
							type: "domResponse",
							requestId,
							text: JSON.stringify({ success: true, store: storeName }),
						})
					} else {
						vscode.postMessage({
							type: "domResponse",
							requestId,
							text: JSON.stringify({ error: "No snapshot provided" }),
						})
					}
					break
				}
			}
		}

		function handleStoreQuery(e: MessageEvent) {
			const message = e.data as Record<string, unknown>
			if (message.type !== "action" || !message.requestId) return
			const action = message.action as string
			const storeActions = [
				"getStoreSnapshot",
				"filterStoreState",
				"getStoreActions",
				"filterStoreActions",
				"searchStoreActions",
				"countStoreActions",
				"applyStoreSnapshot",
			]
			if (storeActions.includes(action)) {
				handleStoreAction(message).catch((err) => {
					console.error("[STORE_QUERY] Error:", err)
					vscode.postMessage({
						type: "domResponse",
						requestId: message.requestId as string,
						text: JSON.stringify({ error: String(err) }),
					})
				})
			}
		}
		window.addEventListener("message", handleStoreQuery)
		return () => window.removeEventListener("message", handleStoreQuery)
	}, [])

	useEffect(() => {
		if (shouldShowAnnouncement) {
			setShowAnnouncement(true)
			rootStore.settings.didShowAnnouncement()
		}
	}, [shouldShowAnnouncement])

	useEffect(() => {
		if (didHydrateState) {
			telemetryClient.updateTelemetryState(telemetrySetting, telemetryKey, machineId)
		}
	}, [telemetrySetting, telemetryKey, machineId, didHydrateState])

	useEffect(() => rootStore.windowManager.webviewDidLaunch(), [])

	useEffect(() => {
		initializeSourceMaps()
		if (process.env.NODE_ENV === "production") {
			exposeSourceMapsForDebugging()
		}
	}, [])

	useAddNonInteractiveClickListener(
		useCallback(() => {
			if (renderContext === "editor") {
				rootStore.windowManager.focusPanel()
			}
		}, [renderContext]),
	)

	useEffect(() => {
		if (wm.activeWindows.some((w: any) => w.type === "marketplace")) {
			telemetryClient.capture(TelemetryEventName.MARKETPLACE_TAB_VIEWED)
		}
	}, [wm])

	if (!didHydrateState) {
		return null
	}

	return (
		<>
			<LocatorBridge />
			{showWelcome ? (
				<WelcomeView />
			) : (
				<div style={{ position: "relative", width: "100%", height: "100vh", overflow: "hidden" }}>
					{wm.activeWindows.map((aw, index) => {
						const isActive = index === wm.activeWindows.length - 1
						const zIndex = 10 + index * 10

						// Get a friendly name for the window layer
						let windowName: string = aw.type
						if (aw.type === "chat" && aw.props?.targetNodeId) {
							const targetNodeId = aw.props.targetNodeId as string
							const node = chatTreeStore.nodes.get(targetNodeId)
							if (node) {
								windowName = node.mode || "Agent"
							}
						}

						switch (aw.type) {
							case "chat":
								return (
									<WindowLayer
										key={`chat-${(aw.props?.targetNodeId as string) || "root"}`}
										id={windowName}
										zIndex={zIndex}
										isActive={isActive}
										isInStack={true}
										index={index}>
										<ChatView
											ref={chatViewRef}
											isHidden={false}
											showAnnouncement={showAnnouncement}
											hideAnnouncement={() => setShowAnnouncement(false)}
											targetNodeId={aw.props?.targetNodeId as string | undefined}
										/>
									</WindowLayer>
								)
							case "history":
								return (
									<WindowLayer
										key="history"
										id="History"
										zIndex={zIndex}
										isActive={isActive}
										isInStack={true}
										index={index}>
										<HistoryView onDone={() => wm.switchToBaseWindow("chat")} />
									</WindowLayer>
								)
							case "settings":
								return (
									<WindowLayer
										key="settings"
										id="Settings"
										zIndex={zIndex}
										isActive={isActive}
										isInStack={true}
										index={index}>
										<SettingsView
											ref={settingsRef}
											onDone={() => wm.switchToBaseWindow("chat")}
											targetSection={aw.props?.targetSection as string | undefined}
										/>
									</WindowLayer>
								)
							case "marketplace":
								return (
									<WindowLayer
										key="marketplace"
										id="Marketplace"
										zIndex={zIndex}
										isActive={isActive}
										isInStack={true}
										index={index}>
										<MarketplaceView
											stateManager={marketplaceStateManager}
											onDone={() => wm.switchToBaseWindow("chat")}
											targetTab={aw.props?.marketplaceTab as "mcp" | "mode" | undefined}
										/>
									</WindowLayer>
								)
							case "cloud":
								return (
									<WindowLayer
										key="cloud"
										id="Cloud"
										zIndex={zIndex}
										isActive={isActive}
										isInStack={true}
										index={index}>
										<CloudView
											userInfo={cloudUserInfo}
											isAuthenticated={cloudIsAuthenticated}
											cloudApiUrl={cloudApiUrl}
											organizations={cloudOrganizations}
										/>
									</WindowLayer>
								)
							case "task_hierarchy":
								return (
									<WindowLayer
										key="task_hierarchy"
										id="Hierarchy"
										zIndex={zIndex}
										isActive={isActive}
										isInStack={true}
										index={index}>
										<ChatTreeViewer />
									</WindowLayer>
								)
							default:
								return null
						}
					})}

					{interactiveAppUri && (
						<WindowLayer id="App" zIndex={1000} isActive={true} isInStack={true} index={0}>
							<McpIframeRenderer
								resourceUri={interactiveAppUri}
								agentsList={JSON.stringify(
									getAllModes(customModes).map((m) => ({
										slug: m.slug,
										name: m.name,
									})),
								)}
								onResolve={(data) => {
									rootStore.chat.elicitResponse(data)
									setInteractiveAppUri("")
								}}
							/>
						</WindowLayer>
					)}

					{deleteMessageDialogState.hasCheckpoint ? (
						<MemoizedCheckpointRestoreDialog
							open={deleteMessageDialogState.isOpen}
							type="delete"
							hasCheckpoint={deleteMessageDialogState.hasCheckpoint}
							onOpenChange={(open: boolean) =>
								setDeleteMessageDialogState((prev) => ({ ...prev, isOpen: open }))
							}
							onConfirm={(restoreCheckpoint: boolean) => {
								rootStore.chat.confirmDeleteMessage(
									deleteMessageDialogState.messageTs,
									restoreCheckpoint,
								)
								setDeleteMessageDialogState((prev) => ({ ...prev, isOpen: false }))
							}}
						/>
					) : (
						<MemoizedDeleteMessageDialog
							open={deleteMessageDialogState.isOpen}
							onOpenChange={(open: boolean) =>
								setDeleteMessageDialogState((prev) => ({ ...prev, isOpen: open }))
							}
							onConfirm={() => {
								rootStore.chat.confirmDeleteMessage(deleteMessageDialogState.messageTs)
								setDeleteMessageDialogState((prev) => ({ ...prev, isOpen: false }))
							}}
						/>
					)}
					{editMessageDialogState.hasCheckpoint ? (
						<MemoizedCheckpointRestoreDialog
							open={editMessageDialogState.isOpen}
							type="edit"
							hasCheckpoint={editMessageDialogState.hasCheckpoint}
							onOpenChange={(open: boolean) =>
								setEditMessageDialogState((prev) => ({ ...prev, isOpen: open }))
							}
							onConfirm={(restoreCheckpoint: boolean) => {
								rootStore.chat.confirmEditMessage(
									editMessageDialogState.messageTs,
									editMessageDialogState.text,
									restoreCheckpoint,
								)
								setEditMessageDialogState((prev) => ({ ...prev, isOpen: false }))
							}}
						/>
					) : (
						<MemoizedEditMessageDialog
							open={editMessageDialogState.isOpen}
							onOpenChange={(open: boolean) =>
								setEditMessageDialogState((prev) => ({ ...prev, isOpen: open }))
							}
							onConfirm={() => {
								rootStore.chat.confirmEditMessage(
									editMessageDialogState.messageTs,
									editMessageDialogState.text,
									undefined,
									editMessageDialogState.images,
								)
								setEditMessageDialogState((prev) => ({ ...prev, isOpen: false }))
							}}
						/>
					)}
				</div>
			)}
		</>
	)
})

const queryClient = new QueryClient()

const AppWithProviders = () => {
	const postMessage = React.useCallback((msg: unknown) => vscode.postMessage(msg as WebviewMessage), [])
	const rootStore = useMemo(() => createRootStore(), [])

	// Register the MST store's extension message listener so that "state",
	// "theme", "action", and other messages from the extension host are
	// processed — notably sets didHydrateState = true on the "state" message.
	useEffect(() => {
		rootStore.initMessageListener()
	}, [rootStore])

	useEffect(() => {
		const handler = createDomMessageHandler(postMessage)
		window.addEventListener("message", handler)
		return () => window.removeEventListener("message", handler)
	}, [postMessage])

	return (
		<RootStoreContext.Provider value={rootStore}>
			<ErrorBoundary>
				<QueryClientProvider client={queryClient}>
					<TooltipProvider delayDuration={STANDARD_TOOLTIP_DELAY}>
						<AppContent />
					</TooltipProvider>
				</QueryClientProvider>
			</ErrorBoundary>
		</RootStoreContext.Provider>
	)
}

export default AppWithProviders
