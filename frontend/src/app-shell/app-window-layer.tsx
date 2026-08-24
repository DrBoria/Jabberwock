import { MarketplaceViewStateManager } from "@src/features/marketplace/components/state/MarketplaceViewStateManager"
import { WindowLayer } from "@src/features/foundation/window-manager/window-layer"
import ChatView from "@src/features/chat/task/messages/view"
import type { ChatViewRef } from "@src/features/chat/task/messages/view"
import HistoryView from "@src/features/history/components/HistoryView"
import SettingsView from "@src/features/settings/components/SettingsView/SettingsView"
import type { SettingsViewRef } from "@src/features/settings/components/SettingsView/types"
import { MarketplaceView } from "@src/features/marketplace/components/MarketplaceView"
import { CloudView } from "@src/features/cloud/components/CloudView"
import { ChatTreeViewer } from "@src/features/chat/task/messages/components/displays/sidebar"
import type { CloudUserInfo, CloudOrganizationMembership } from "@jabberwock/types"
import type { WindowTypeValue } from "@src/features/foundation/window-manager/store"

interface AppWindowLayerProps {
	awType: string
	props: Record<string, unknown> | undefined
	index: number
	isActive: boolean
	zIndex: number
	windowName: string
	chatViewRef: React.RefObject<ChatViewRef | null>
	settingsRef: React.RefObject<SettingsViewRef | null>
	showAnnouncement: boolean
	hideAnnouncement: () => void
	onSwitchToBaseWindow: (tab: WindowTypeValue) => void
	marketplaceStateManager: MarketplaceViewStateManager
	cloudUserInfo: CloudUserInfo | null
	cloudIsAuthenticated: boolean
	cloudApiUrl: string
	cloudOrganizations: CloudOrganizationMembership[] | null
}

export const AppWindowLayer = ({
	awType,
	props,
	index,
	isActive,
	zIndex,
	windowName,
	chatViewRef,
	settingsRef,
	showAnnouncement,
	hideAnnouncement,
	onSwitchToBaseWindow,
	marketplaceStateManager,
	cloudUserInfo,
	cloudIsAuthenticated,
	cloudApiUrl,
	cloudOrganizations,
}: AppWindowLayerProps) => {
	const tnid = props?.targetNodeId as string | undefined
	const ts = props?.targetSection as string | undefined
	const mt = props?.marketplaceTab as "mcp" | "mode" | undefined

	const layers: Record<string, React.ReactNode> = {
		chat: (
			<WindowLayer
				key={`chat-${tnid}`}
				id={windowName}
				zIndex={zIndex}
				isActive={isActive}
				isInStack={true}
				index={index}>
				<ChatView
					ref={chatViewRef as React.Ref<ChatViewRef>}
					isHidden={false}
					showAnnouncement={showAnnouncement}
					hideAnnouncement={hideAnnouncement}
					targetNodeId={tnid}
				/>
			</WindowLayer>
		),
		history: (
			<WindowLayer key="history" id="History" zIndex={zIndex} isActive={isActive} isInStack={true} index={index}>
				<HistoryView onDone={() => onSwitchToBaseWindow("chat")} />
			</WindowLayer>
		),
		settings: (
			<WindowLayer
				key="settings"
				id="Settings"
				zIndex={zIndex}
				isActive={isActive}
				isInStack={true}
				index={index}>
				<SettingsView
					ref={settingsRef as React.Ref<SettingsViewRef>}
					onDone={() => onSwitchToBaseWindow("chat")}
					targetSection={ts}
				/>
			</WindowLayer>
		),
		marketplace: (
			<WindowLayer
				key="marketplace"
				id="Marketplace"
				zIndex={zIndex}
				isActive={isActive}
				isInStack={true}
				index={index}>
				<MarketplaceView
					stateManager={marketplaceStateManager}
					onDone={() => onSwitchToBaseWindow("chat")}
					targetTab={mt}
				/>
			</WindowLayer>
		),
		cloud: (
			<WindowLayer key="cloud" id="Cloud" zIndex={zIndex} isActive={isActive} isInStack={true} index={index}>
				<CloudView
					userInfo={cloudUserInfo}
					isAuthenticated={cloudIsAuthenticated}
					cloudApiUrl={cloudApiUrl}
					organizations={cloudOrganizations ?? undefined}
				/>
			</WindowLayer>
		),
		task_hierarchy: (
			<WindowLayer
				key="task_hierarchy"
				id="Hierarchy"
				zIndex={zIndex}
				isActive={isActive}
				isInStack={true}
				index={index}>
				<ChatTreeViewer />
			</WindowLayer>
		),
	}

	return layers[awType] ?? null
}
