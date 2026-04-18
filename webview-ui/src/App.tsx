import React, { useCallback, useEffect, useRef, useState, useMemo } from "react"
import { useEvent } from "react-use"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { type ExtensionMessage, TelemetryEventName } from "@jabberwock/types"

import TranslationProvider from "./i18n/TranslationContext"
import { MarketplaceViewStateManager } from "./components/marketplace/MarketplaceViewStateManager"

import { vscode } from "./utils/vscode"
import { telemetryClient } from "./utils/TelemetryClient"
import { initializeSourceMaps, exposeSourceMapsForDebugging } from "./utils/sourceMapInitializer"
import { ExtensionStateContextProvider, useExtensionState } from "./context/ExtensionStateContext"
import { ChatTreeProvider } from "./context/ChatTreeContext"
import { WindowManagerProvider, useWindowManager, WindowType } from "./context/WindowManagerContext"
import { WindowLayer } from "./components/layout/WindowLayer"

import ChatView, { ChatViewRef } from "./components/chat/ChatView"
import HistoryView from "./components/history/HistoryView"
import SettingsView, { SettingsViewRef } from "./components/settings/SettingsView"
import WelcomeView from "./components/welcome/WelcomeViewProvider"
import { MarketplaceView } from "./components/marketplace/MarketplaceView"
import { CheckpointRestoreDialog } from "./components/chat/CheckpointRestoreDialog"
import { DeleteMessageDialog, EditMessageDialog } from "./components/chat/MessageModificationConfirmationDialog"
import ErrorBoundary from "./components/ErrorBoundary"
import { CloudView } from "./components/cloud/CloudView"
import { useAddNonInteractiveClickListener } from "./components/ui/hooks/useNonInteractiveClick"
import { TooltipProvider } from "./components/ui/tooltip"
import { STANDARD_TOOLTIP_DELAY } from "./components/ui/standard-tooltip"
import { McpIframeRenderer } from "./features/mcp-apps/McpIframeRenderer"
import { getAllModes } from "@shared/modes"
import { LocatorBridge } from "./features/devtools/utils/LocatorBridge"
import { ChatTreeViewer } from "./components/chat/ChatTreeViewer"
import { chatTreeStore } from "./state/ChatTreeStore"

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

const tabsByMessageAction: Partial<Record<NonNullable<ExtensionMessage["action"]>, WindowType>> = {
	chatButtonClicked: "chat",
	settingsButtonClicked: "settings",
	historyButtonClicked: "history",
	marketplaceButtonClicked: "marketplace",
	cloudButtonClicked: "cloud",
}

const AppContent = () => {
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

	const { pushWindow, activeWindows, switchToBaseWindow } = useWindowManager()

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
		(newTab: WindowType, props?: any) => {
			console.log(`[App] switchTab requested: ${newTab}`, props)
			if (mdmCompliant === false && newTab !== "cloud") {
				console.warn(`[App] switchTab BLOCKED by mdmCompliant === false`)
				vscode.postMessage({ type: "showMdmAuthRequiredNotification" })
				return
			}

			const doSwitch = () => {
				console.log(`[App] Executing doSwitch to ${newTab}`)
				if (newTab === "chat") {
					switchToBaseWindow("chat")
				} else {
					pushWindow(newTab, props)
				}
			}

			if (settingsRef.current?.checkUnsaveChanges) {
				console.log(`[App] Checking unsaved changes before switch`)
				settingsRef.current.checkUnsaveChanges(doSwitch)
			} else {
				doSwitch()
			}
		},
		[mdmCompliant, pushWindow, switchToBaseWindow],
	)

	const onMessage = useCallback(
		(e: MessageEvent) => {
			const message: ExtensionMessage = e.data

			if (message.type === "action" && message.action) {
				console.log(`[App] Received action message: ${message.action}`, message)
				// Prevent infinite loops by ignoring switchTab messages that came from MCP
				if (message.action === "switchTab" && message.tab && !message.fromMCP) {
					const targetTab = message.tab as WindowType
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
						switchTab(newTab, { section, marketplaceTab })
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

			if (message.type === "getDom") {
				if (message.requestId) {
					console.log(`[DEBUG: DOM] Webview: Received getDom request ${message.requestId}`)
					const dom = document.documentElement.outerHTML
					console.log(
						`[DEBUG: DOM] Webview: Sending domResponse for ${message.requestId} (size: ${dom.length})`,
					)
					vscode.postMessage({
						type: "domResponse",
						requestId: message.requestId,
						text: dom,
					})
				}
			}
		},
		[switchTab],
	)

	useEvent("message", onMessage)

	useEffect(() => {
		if (shouldShowAnnouncement) {
			setShowAnnouncement(true)
			vscode.postMessage({ type: "didShowAnnouncement" })
		}
	}, [shouldShowAnnouncement])

	useEffect(() => {
		if (didHydrateState) {
			telemetryClient.updateTelemetryState(telemetrySetting, telemetryKey, machineId)
		}
	}, [telemetrySetting, telemetryKey, machineId, didHydrateState])

	useEffect(() => vscode.postMessage({ type: "webviewDidLaunch" }), [])

	useEffect(() => {
		initializeSourceMaps()
		if (process.env.NODE_ENV === "production") {
			exposeSourceMapsForDebugging()
		}
	}, [])

	useAddNonInteractiveClickListener(
		useCallback(() => {
			if (renderContext === "editor") {
				vscode.postMessage({ type: "focusPanelRequest" })
			}
		}, [renderContext]),
	)

	useEffect(() => {
		if (activeWindows.some((w: any) => w.type === "marketplace")) {
			telemetryClient.capture(TelemetryEventName.MARKETPLACE_TAB_VIEWED)
		}
	}, [activeWindows])

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
					{activeWindows.map((aw, index) => {
						const isActive = index === activeWindows.length - 1
						const zIndex = 10 + index * 10

						// Get a friendly name for the window layer
						let windowName: string = aw.type
						if (aw.type === "chat" && aw.props?.targetNodeId) {
							const node = chatTreeStore.nodes.get(aw.props.targetNodeId)
							if (node) {
								windowName = node.mode || "Agent"
							}
						}

						switch (aw.type) {
							case "chat":
								return (
									<WindowLayer
										key={`chat-${aw.props?.targetNodeId || "root"}`}
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
											targetNodeId={aw.props?.targetNodeId}
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
										<HistoryView onDone={() => switchToBaseWindow("chat")} />
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
											onDone={() => switchToBaseWindow("chat")}
											targetSection={aw.props?.targetSection}
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
											onDone={() => switchToBaseWindow("chat")}
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
										mode: m.slug,
										name: m.name,
									})),
								)}
								onResolve={(data) => {
									vscode.postMessage({ type: "elicitationResponse", values: data })
									setInteractiveAppUri(undefined)
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
								vscode.postMessage({
									type: "deleteMessageConfirm",
									messageTs: deleteMessageDialogState.messageTs,
									restoreCheckpoint,
								})
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
								vscode.postMessage({
									type: "deleteMessageConfirm",
									messageTs: deleteMessageDialogState.messageTs,
								})
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
								vscode.postMessage({
									type: "editMessageConfirm",
									messageTs: editMessageDialogState.messageTs,
									text: editMessageDialogState.text,
									restoreCheckpoint,
								})
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
								vscode.postMessage({
									type: "editMessageConfirm",
									messageTs: editMessageDialogState.messageTs,
									text: editMessageDialogState.text,
									images: editMessageDialogState.images,
								})
								setEditMessageDialogState((prev) => ({ ...prev, isOpen: false }))
							}}
						/>
					)}
				</div>
			)}
		</>
	)
}

const queryClient = new QueryClient()

const AppWithProviders = () => {
	return (
		<ErrorBoundary>
			<ChatTreeProvider>
				<ExtensionStateContextProvider>
					<TranslationProvider>
						<QueryClientProvider client={queryClient}>
							<TooltipProvider delayDuration={STANDARD_TOOLTIP_DELAY}>
								<WindowManagerProvider>
									<AppContent />
								</WindowManagerProvider>
							</TooltipProvider>
						</QueryClientProvider>
					</TranslationProvider>
				</ExtensionStateContextProvider>
			</ChatTreeProvider>
		</ErrorBoundary>
	)
}

export default AppWithProviders
