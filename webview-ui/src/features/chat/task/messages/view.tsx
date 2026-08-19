import React, { forwardRef, useImperativeHandle, useMemo, useRef } from "react"

import { observer } from "mobx-react-lite"

import { ProfileValidator } from "@shared/ProfileValidator"

import { useAppTranslation } from "@src/i18n/TranslationContext"

import { rootStore } from "@src/features/store"
import { useChatUI } from "@src/features/chat/store"
import { CloudUpsellDialog } from "@src/features/cloud/components/CloudUpsellDialog"

import TelemetryBanner from "@src/features/foundation/components/ui/display/TelemetryBanner"
import Announcement from "@src/features/chat/task/notifications/announcement"
import WarningRow from "@src/features/chat/task/messages/components/row/warning-row"
import { ChatTextArea } from "@sections/dndTextArea/view"
import ProfileViolationWarning from "@src/features/chat/task/messages/components/row/context-rows/profile-violation-warning"
import { QueuedMessages } from "@src/features/chat/task/notifications/queued-messages"

import { useCloudUpsell } from "@src/hooks/useCloudUpsell"

import { HomeScreen } from "./components/displays/home-screen"
import { ChatArea } from "./components/chat-area/message-area"

import { ctrlOrCmd, getPlaceholderText, getGoals } from "./chat-view-utils"
import { useSoundEffects, useModeSwitch } from "./chat-view-hooks"
import {
	useGoalHandlers,
	useSendMessageHandlers,
	useMessageReceiver,
	useQueueHandlers,
	useModelInfo,
} from "./chat-view-callbacks"

export interface ChatViewProps {
	isHidden: boolean
	showAnnouncement: boolean
	hideAnnouncement: () => void
	targetNodeId?: string
}

export interface ChatViewRef {
	acceptInput: () => void
}

const ChatViewComponent: React.ForwardRefRenderFunction<ChatViewRef, ChatViewProps> = (props, ref) => {
	const { isHidden, showAnnouncement, hideAnnouncement } = props
	const [audioBaseUri] = React.useState(() => (window as Window & { AUDIO_BASE_URI?: string }).AUDIO_BASE_URI || "")

	const { t } = useAppTranslation()
	const modeShortcutText = `${ctrlOrCmd} + . ${t("chat:forNextMode")}, ${ctrlOrCmd} + Shift + . ${t("chat:forPreviousMode")}`

	const {
		currentTaskItem,
		apiConfiguration,
		organizationAllowList,
		mode,
		customModes,
		telemetrySetting,
		soundEnabled,
		soundVolume,
		messageQueue = [],
	} = rootStore.extensionState

	const store = rootStore.chat
	const ui = useChatUI()

	const textAreaRef = useRef<HTMLTextAreaElement>(null)
	const _lastTtsRef = useRef<string>("")
	const _autoApproveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

	const { isOpen: isUpsellOpen, openUpsell, closeUpsell, handleConnect } = useCloudUpsell({ autoOpenOnAuth: false })

	const isProfileDisabled = useMemo(
		() => !!apiConfiguration && !ProfileValidator.isProfileAllowed(apiConfiguration, organizationAllowList),
		[apiConfiguration, organizationAllowList],
	)

	const { playSound } = useSoundEffects(audioBaseUri, soundEnabled ?? false, soundVolume)
	useModeSwitch(mode, customModes)

	const isStreaming = ui.isStreaming

	const { handleAddGoal, handleRemoveGoal, handleUpdateGoal, handleReorderGoals } = useGoalHandlers()
	const { handleSendMessage, handleEnqueueCurrentMessage, handleStopTask } = useSendMessageHandlers(
		apiConfiguration,
		isStreaming,
		messageQueue,
		store,
		ui,
	)
	useMessageReceiver(playSound as (type: string) => void)
	const { handleRemoveQueuedMessage, handleEditQueuedMessage } = useQueueHandlers(
		messageQueue as { id: string; images: string[] }[],
		store,
	)
	const { selectImages, shouldDisableImages } = useModelInfo(apiConfiguration)

	const placeholderText = getPlaceholderText(currentTaskItem, t)

	useImperativeHandle(ref, () => ({
		acceptInput: () => {
			const hasInput = ui.textArea.inputValue.trim() || ui.textArea.selectedImages.length > 0
			if (ui.currentAsk === "command_output" && hasInput) {
				const images = ui.textArea.selectedImages.slice()
				store.queueMessage(ui.textArea.inputValue.trim(), images)
				ui.textArea.clearInput()
				return
			}
			if (ui.enableButtons && ui.primaryButtonText) {
				store.handlePrimaryButtonClick(
					ui.currentAsk ?? undefined,
					currentTaskItem,
					[],
					ui.textArea.inputValue,
					ui.textArea.selectedImages.slice(),
				)
			} else if (!ui.textArea.sendingDisabled && !isProfileDisabled && hasInput)
				handleSendMessage(ui.textArea.inputValue, ui.textArea.selectedImages)
		},
	}))

	const handleHideAnnouncement = useMemo(() => {
		const hide = () => {
			if (ui.showAnnouncementModal) ui.setShowAnnouncementModal(false)
			if (showAnnouncement) hideAnnouncement()
		}
		return hide
	}, [ui, showAnnouncement, hideAnnouncement])

	const shouldShowAnnouncement = showAnnouncement || ui.showAnnouncementModal
	const shouldShowTelemetryBanner = telemetrySetting === "unset"
	const shouldShowRetiredWarning = ui.showRetiredProviderWarning
	const shouldShowProfileWarning = isProfileDisabled
	const goals = getGoals(isStreaming, currentTaskItem)

	if (!currentTaskItem) return <HomeScreen openUpsell={openUpsell} />

	return (
		<div data-testid="chat-view" className="fixed top-0 left-0 right-0 bottom-0 flex flex-col overflow-hidden">
			{shouldShowTelemetryBanner && <TelemetryBanner />}
			{shouldShowAnnouncement && <Announcement hideAnnouncement={handleHideAnnouncement} />}
			<ChatArea isHidden={isHidden} />
			<QueuedMessages
				queue={messageQueue}
				onRemove={handleRemoveQueuedMessage}
				onUpdate={handleEditQueuedMessage}
			/>
			{shouldShowRetiredWarning && (
				<div className="px-[15px] py-1">
					<WarningRow
						title={t("chat:retiredProvider.title")}
						message={t("chat:retiredProvider.message")}
						actionText={t("chat:retiredProvider.openSettings")}
						onAction={() => rootStore.windowManager.switchTab("settings")}
					/>
				</div>
			)}
			<ChatTextArea
				ref={textAreaRef}
				placeholderText={placeholderText}
				onSend={() => handleSendMessage(ui.textArea.inputValue, ui.textArea.selectedImages.slice())}
				onSelectImages={selectImages}
				shouldDisableImages={shouldDisableImages}
				onHeightChange={() => {}}
				modeShortcutText={modeShortcutText}
				isStreaming={isStreaming}
				onStop={handleStopTask}
				onEnqueueMessage={handleEnqueueCurrentMessage}
				goals={goals}
				onAddGoal={handleAddGoal}
				onRemoveGoal={handleRemoveGoal}
				onUpdateGoal={handleUpdateGoal}
				onReorderGoals={handleReorderGoals}
			/>
			{shouldShowProfileWarning && (
				<div className="px-3">
					<ProfileViolationWarning />
				</div>
			)}
			<div id="jabberwock-portal" />
			<CloudUpsellDialog open={isUpsellOpen} onOpenChange={closeUpsell} onConnect={handleConnect} />
		</div>
	)
}

export default observer(forwardRef(ChatViewComponent))
