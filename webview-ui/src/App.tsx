import React, { useCallback, useEffect, useRef, useState, useMemo } from "react"
import { useEvent } from "react-use"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { type ExtensionMessage, type WebviewMessage, TelemetryEventName } from "@jabberwock/types"

import { MarketplaceViewStateManager } from "./features/marketplace/components/MarketplaceViewStateManager"

import { observer } from "mobx-react-lite"
import { vscode } from "@jabberwock/devtool/webview"
import { createDomMessageHandler } from "@jabberwock/devtool/webview"
import { telemetryClient } from "./features/cloud/utils/TelemetryClient"
import { initializeSourceMaps, exposeSourceMapsForDebugging } from "@jabberwock/devtool/webview"
import { type WindowTypeValue } from "./features/foundation/window-manager/store"
import { WindowLayer } from "./features/foundation/window-manager/window-layer"

import ChatView, { ChatViewRef } from "./features/chat/task/messages/view"
import { rootStore, RootStoreContext, createRootStore } from "./features/store"
import HistoryView from "./features/history/components/HistoryView"
import SettingsView, { SettingsViewRef } from "./features/settings/components/SettingsView"
import WelcomeView from "./features/chat/extension-state/components/WelcomeViewProvider"
import { MarketplaceView } from "./features/marketplace/components/MarketplaceView"
import { CheckpointRestoreDialog } from "./features/chat/task/notifications/checkpoint/checkpoint-restore-dialog"
import {
	DeleteMessageDialog,
	EditMessageDialog,
} from "./features/chat/task/notifications/message-modification-confirmation-dialog"
import ErrorBoundary from "./features/foundation/components/ErrorBoundary"
import { CloudView } from "./features/cloud/components/CloudView"
import { useAddNonInteractiveClickListener } from "./features/foundation/ui/hooks/useNonInteractiveClick"
import { TooltipProvider } from "./features/foundation/ui/tooltip"
import { STANDARD_TOOLTIP_DELAY } from "./features/foundation/ui/standard-tooltip"
import { McpIframeRenderer } from "./features/settings/mcp/McpIframeRenderer"
import { getAllModes } from "@shared/modes"
import { LocatorBridge } from "@jabberwock/devtool/webview"
import { ChatTreeViewer } from "./features/chat/task/messages/components/sidebar"
import { chatTreeStore } from "./features/chat/task/messages/store"
import { getFrontendActionBuffer } from "./features/root-store"

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
	const s = rootStore.extensionState
	const cloud = rootStore.cloud
	const didHydrateState = rootStore.didHydrateState
	const showWelcome = rootStore.showWelcome
	const shouldShowAnnouncement = s.shouldShowAnnouncement
	const telemetrySetting = s.telemetrySetting
	const telemetryKey = s.telemetryKey
	const machineId = s.machineId
	const cloudUserInfo = s.cloudUserInfo
	const cloudIsAuthenticated = cloud.cloudIsAuthenticated
	const cloudApiUrl = s.cloudApiUrl
	const cloudOrganizations = cloud.cloudOrganizations
	const renderContext = s.renderContext
	const mdmCompliant = s.mdmCompliant
	const interactiveAppUri = rootStore.interactiveAppUri
	const setInteractiveAppUri = (uri: string) => rootStore.setInteractiveAppUri(uri)
	const customModes = s.customModes

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
				console.warn(`[jabberwock] [App] switchTab BLOCKED by mdmCompliant === false`)
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
					// Skip store query actions (handled by createDomMessageHandler) and DOM handler
					// actions (handled by DevtoolProvider) to avoid double-handling
					const storeQueryActions = [
						"getRootSnapshot",
						"getActionBuffer",
						"applySnapshot",
						"getConsoleLogs",
						"searchConsole",
					]
					const domHandlerActions = [
						"getActivePage",
						"findElement",
						"clickElement",
						"typeText",
						"scrollElement",
						"selectOption",
						"getScreenshot",
						"dragElement",
						"dragFromTo",
					]
					const requestId = message.requestId
					if (
						requestId &&
						!storeQueryActions.includes(message.action) &&
						!domHandlerActions.includes(message.action)
					) {
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
		const handler = createDomMessageHandler(postMessage, rootStore, {
			getActionBuffer: getFrontendActionBuffer,
		})
		window.addEventListener("message", handler)
		return () => window.removeEventListener("message", handler)
	}, [postMessage, rootStore])

	// Proactive state request: if the "state" message from the extension host
	// is missed (race condition at startup), the webview will never hydrate
	// and shows an empty DOM. This timeout sends a requestState message
	// after 500ms if didHydrateState is still false.
	useEffect(() => {
		const timer = setTimeout(() => {
			if (!rootStore.didHydrateState) {
				console.warn("[jabberwock] State not received within 500ms — requesting state from extension host")
				vscode.postMessage({ type: "requestState" })
			}
		}, 500)
		return () => clearTimeout(timer)
	}, [rootStore])

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
