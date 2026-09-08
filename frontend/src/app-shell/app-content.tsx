import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { observer } from "mobx-react-lite"
import { LocatorBridge, initializeSourceMaps, exposeSourceMapsForDebugging } from "@jabberwock/devtool/webview"
import { TelemetryEventName } from "@jabberwock/types"
import { telemetryClient } from "@src/features/cloud/utils/TelemetryClient"
import { rootStore } from "@src/features/store"
import { useMessageHandler, getWindowLabel } from "./app-message-utils"
import { AppDialogs } from "./app-dialogs"
import { AppWindowLayer } from "./app-window-layer"
import { WindowLayer } from "@src/features/foundation/window-manager/window-layer"
import { MarketplaceViewStateManager } from "@src/features/marketplace/components/state/MarketplaceViewStateManager"
import { useAddNonInteractiveClickListener } from "@src/features/foundation/ui/hooks/useInteraction/useNonInteractiveClick"
import { McpIframeRenderer } from "@src/features/settings/mcp/McpIframeRenderer"
import { isWebMode } from "@src/connector-bus"
import { Timeline } from "@src/features/context"
import { getAllModes } from "@shared/modes"
import type { DeleteMessageDialogState, EditMessageDialogState } from "./app-types"
import type { SettingsViewRef } from "../features/settings/components/SettingsView/types"
import type { ChatViewRef } from "../features/chat/task/messages/view"
import type { WindowTypeValue } from "../features/foundation/window-manager/store"
import WelcomeView from "../features/chat/extension-state/components/WelcomeViewProvider"

export const AppContent = observer(() => {
	const appRenderCount = useRef(0)
	appRenderCount.current++
	console.log(`[DEBUG:APP] AppContent RENDER #${appRenderCount.current}`)
	const s = rootStore.extensionState,
		cloud = rootStore.cloud,
		didHydrateState = rootStore.didHydrateState,
		showWelcome = rootStore.showWelcome,
		shouldShowAnnouncement = s.shouldShowAnnouncement,
		telemetrySetting = s.telemetrySetting,
		telemetryKey = s.telemetryKey,
		machineId = s.machineId,
		cloudUserInfo = s.cloudUserInfo,
		cloudIsAuthenticated = cloud.cloudIsAuthenticated,
		cloudApiUrl = s.cloudApiUrl || "",
		cloudOrganizations = cloud.cloudOrganizations,
		renderContext = s.renderContext,
		mdmCompliant = s.mdmCompliant,
		interactiveAppUri = rootStore.interactiveAppUri,
		customModes = s.customModes
	const setInteractiveAppUri = (uri: string) => rootStore.setInteractiveAppUri(uri),
		wm = rootStore.windowManager
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
	const settingsRef = useRef<SettingsViewRef>(null),
		chatViewRef = useRef<ChatViewRef>(null)

	const switchTab = useCallback(
		(newTab: string, props?: Record<string, unknown>) => {
			console.log(`[App] switchTab requested: ${newTab}`, props)
			const isBlockedByMdm = mdmCompliant === false && newTab !== "cloud"
			if (isBlockedByMdm) {
				console.warn(`[jabberwock] [App] switchTab BLOCKED by mdmCompliant === false`)
				rootStore.chat.showMdmAuthNotification()
				return
			}
			const doSwitch = () => {
				console.log(`[App] Executing doSwitch to ${newTab}`, props)
				if (newTab === "chat") {
					if (props?.targetNodeId) {
						wm.pushWindow("chat", { targetNodeId: props.targetNodeId })
					} else {
						wm.switchToBaseWindow("chat")
					}
				} else {
					wm.pushWindow(newTab as WindowTypeValue, props)
				}
			}
			const ct = wm.activeWindows[wm.activeWindows.length - 1],
				huc = ct?.type === "settings" && settingsRef.current?.checkUnsaveChanges
			if (huc) {
				settingsRef.current!.checkUnsaveChanges(doSwitch)
			} else {
				doSwitch()
			}
		},
		[mdmCompliant, wm],
	)

	const handleOpenDeleteDialog = useCallback((messageTs: number, hasCheckpoint: boolean) => {
		setDeleteMessageDialogState({ isOpen: true, messageTs, hasCheckpoint })
	}, [])
	const handleOpenEditDialog = useCallback(
		(messageTs: number, text: string, hasCheckpoint: boolean, images?: string[]) => {
			setEditMessageDialogState({ isOpen: true, messageTs, text, hasCheckpoint, images: images || [] })
		},
		[],
	)

	useMessageHandler(switchTab, wm, handleOpenDeleteDialog, handleOpenEditDialog, chatViewRef)

	useEffect(() => {
		if (shouldShowAnnouncement) {
			setShowAnnouncement(true)
			rootStore.settings.didShowAnnouncement()
		}
	}, [shouldShowAnnouncement])
	useEffect(() => {
		if (didHydrateState) telemetryClient.updateTelemetryState(telemetrySetting, telemetryKey, machineId)
	}, [telemetrySetting, telemetryKey, machineId, didHydrateState])
	useEffect(() => rootStore.windowManager.webviewDidLaunch(), [])
	useEffect(() => {
		initializeSourceMaps()
		if (process.env.NODE_ENV === "production") exposeSourceMapsForDebugging()
	}, [])
	useAddNonInteractiveClickListener(
		useCallback(() => {
			if (renderContext === "editor") rootStore.windowManager.focusPanel()
		}, [renderContext]),
	)
	useEffect(() => {
		if (wm.activeWindows.some((w: { type: string }) => w.type === "marketplace"))
			telemetryClient.capture(TelemetryEventName.MARKETPLACE_TAB_VIEWED)
	}, [wm.activeWindows])

	if (!didHydrateState) return null

	return (
		<>
			<LocatorBridge />
			{showWelcome ? (
				<WelcomeView />
			) : (
				<div style={{ position: "relative", width: "100%", height: "100vh", overflow: "hidden" }}>
					{wm.activeWindows.map((aw, index) => {
						const isActive = index === wm.activeWindows.length - 1,
							zIndex = 10 + index * 10
						return (
							<AppWindowLayer
								key={`${aw.type}-${index}`}
								awType={aw.type}
								props={aw.props}
								index={index}
								isActive={isActive}
								zIndex={zIndex}
								windowName={getWindowLabel(aw)}
								chatViewRef={chatViewRef}
								settingsRef={settingsRef}
								showAnnouncement={showAnnouncement}
								hideAnnouncement={() => setShowAnnouncement(false)}
								onSwitchToBaseWindow={(tab) => wm.switchToBaseWindow(tab as WindowTypeValue)}
								marketplaceStateManager={marketplaceStateManager}
								cloudUserInfo={cloudUserInfo}
								cloudIsAuthenticated={cloudIsAuthenticated}
								cloudApiUrl={cloudApiUrl}
								cloudOrganizations={cloudOrganizations}
							/>
						)
					})}
					{interactiveAppUri && (
						<WindowLayer id="App" zIndex={1000} isActive={true} isInStack={true} index={0}>
							<McpIframeRenderer
								resourceUri={interactiveAppUri}
								agentsList={JSON.stringify(
									getAllModes(customModes).map((m) => ({ slug: m.slug, name: m.name })),
								)}
								onResolve={(data) => {
									rootStore.chat.elicitResponse(data)
									setInteractiveAppUri("")
								}}
							/>
						</WindowLayer>
					)}
					{/* ICG-D1 full-history timeline — web/watch mode only, when a task is active (spec §7). */}
					{isWebMode() && (s.currentTaskId ?? s.currentTaskItem?.id) && (
						<aside
							className="context-timeline-panel"
							style={{
								position: "absolute",
								top: 0,
								right: 0,
								bottom: 0,
								width: "38%",
								minWidth: 320,
								maxWidth: 720,
								zIndex: 5,
								borderLeft: "1px solid var(--border, #333)",
								background: "var(--background, #111)",
								overflow: "hidden",
							}}>
							<Timeline taskId={s.currentTaskId ?? s.currentTaskItem!.id} />
						</aside>
					)}
					<AppDialogs
						deleteMessageDialogState={deleteMessageDialogState}
						editMessageDialogState={editMessageDialogState}
						onDeleteDialogOpenChange={(open: boolean) =>
							setDeleteMessageDialogState((prev) => ({ ...prev, isOpen: open }))
						}
						onEditDialogOpenChange={(open: boolean) =>
							setEditMessageDialogState((prev) => ({ ...prev, isOpen: open }))
						}
					/>
				</div>
			)}
		</>
	)
})
