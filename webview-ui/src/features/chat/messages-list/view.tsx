import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react"
import { useEvent } from "react-use"
import useSound from "use-sound"

import { observer } from "mobx-react-lite"

import type { ExtensionMessage, AudioType } from "@jabberwock/types"
import { isRetiredProvider } from "@jabberwock/types"

import { getAllModes } from "@shared/modes"
import { ProfileValidator } from "@shared/ProfileValidator"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { rootStore } from "@src/features/store"
import { chatStore, useChatUI } from "@src/features/chat/store"
import { useSelectedModel } from "@src/components/ui/hooks/useSelectedModel"
import { CloudUpsellDialog } from "@src/components/cloud/CloudUpsellDialog"

import TelemetryBanner from "@src/components/common/TelemetryBanner"
import Announcement from "../notifications/announcement"
import WarningRow from "./row/warning-row"
import { ChatTextArea } from "../text-area/view"
import ProfileViolationWarning from "./row/profile-violation-warning"
import { QueuedMessages } from "../notifications/queued-messages"

import { useCloudUpsell } from "@src/hooks/useCloudUpsell"

// Drag-and-drop is handled in the text-area component

import { useWindowManager } from "@src/features/foundation/window-manager/store"

import { HomeScreen } from "./home-screen"
import { ChatArea } from "./message-area"

export interface ChatViewProps {
	isHidden: boolean
	showAnnouncement: boolean
	hideAnnouncement: () => void
	targetNodeId?: string
}

export interface ChatViewRef {
	acceptInput: () => void
}

export const MAX_ATTACHED_IMAGES = 20

const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().indexOf("MAC") >= 0

const ChatViewComponent: React.ForwardRefRenderFunction<ChatViewRef, ChatViewProps> = (props, ref) => {
	const { isHidden, showAnnouncement, hideAnnouncement } = props
	const [audioBaseUri] = React.useState(() => (window as Window & { AUDIO_BASE_URI?: string }).AUDIO_BASE_URI || "")

	const { t } = useAppTranslation()
	const modeShortcutText = `${isMac ? "⌘" : "Ctrl"} + . ${t("chat:forNextMode")}, ${isMac ? "⌘" : "Ctrl"} + Shift + . ${t("chat:forPreviousMode")}`

	const { setMode } = useExtensionState()
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

	const { pushWindow: _pushWindow } = useWindowManager()
	const store = chatStore
	const ui = useChatUI()

	// ── Refs ──────────────────────────────────────────────────────
	const textAreaRef = useRef<HTMLTextAreaElement>(null)
	const _lastTtsRef = useRef<string>("")
	const _autoApproveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

	const { isOpen: isUpsellOpen, openUpsell, closeUpsell, handleConnect } = useCloudUpsell({ autoOpenOnAuth: false })

	const isProfileDisabled = useMemo(
		() => !!apiConfiguration && !ProfileValidator.isProfileAllowed(apiConfiguration, organizationAllowList),
		[apiConfiguration, organizationAllowList],
	)

	// ── Sound ────────────────────────────────────────────────────
	const volume = typeof soundVolume === "number" ? soundVolume : 0.5
	const [playNotification] = useSound(`${audioBaseUri}/notification.wav`, { volume, soundEnabled, interrupt: true })
	const [playCelebration] = useSound(`${audioBaseUri}/celebration.wav`, { volume, soundEnabled, interrupt: true })
	const [playProgressLoop] = useSound(`${audioBaseUri}/progress_loop.wav`, { volume, soundEnabled, interrupt: true })
	const lastPlayedRef = useRef<Record<string, number>>({})

	const playSound = useCallback(
		(audioType: AudioType) => {
			if (!soundEnabled) return
			const now = Date.now()
			const lastPlayed = lastPlayedRef.current[audioType] ?? 0
			if (now - lastPlayed < 100) return
			lastPlayedRef.current[audioType] = now
			switch (audioType) {
				case "notification":
					playNotification()
					break
				case "celebration":
					playCelebration()
					break
				case "progress_loop":
					playProgressLoop()
					break
			}
		},
		[soundEnabled, playNotification, playCelebration, playProgressLoop],
	)

	const isStreaming = ui.isStreaming

	// ── Send handler (simplified — delegates to store) ──────────
	const handleSendMessage = useCallback(
		(text: string, images: string[]) => {
			text = text.trim()
			if (text || images.length > 0) {
				if (apiConfiguration?.apiProvider && isRetiredProvider(apiConfiguration.apiProvider)) {
					ui.setShowRetiredProviderWarning(true)
					return
				}
				if (ui.sendingDisabled || isStreaming || messageQueue.length > 0 || ui.clineAsk === "command_output") {
					store.queueMessage(text, images)
					ui.clearInput()
					return
				}
				store.sendMessage(text, images)
				ui.clearInput()
			}
		},
		[isStreaming, messageQueue.length, apiConfiguration?.apiProvider, ui, store],
	)

	const _handleSetChatBoxMessage = useCallback(
		(text: string, images: string[]) => {
			ui.setInputValue(ui.inputValue !== "" ? ui.inputValue + " " + text : text)
			ui.appendSelectedImages(images)
		},
		[ui],
	)

	const _startNewTask = useCallback(() => {
		ui.setShowRetiredProviderWarning(false)
		ui.clearInput()
		store.clearTask()
	}, [ui, store])

	const handleStopTask = useCallback(() => {
		store.cancelTask()
	}, [store])

	const handleEnqueueCurrentMessage = useCallback(() => {
		const text = ui.inputValue.trim()
		const images = ui.selectedImages.slice()
		if (text || images.length > 0) {
			store.queueMessage(text, images)
			ui.clearInput()
		}
	}, [ui, store])

	const { info: model } = useSelectedModel(apiConfiguration)
	const selectImages = useCallback(() => store.selectImages(), [store])
	const shouldDisableImages = !model?.supportsImages || ui.selectedImages.length >= MAX_ATTACHED_IMAGES

	// ── Message Handler (delegates to ChatStore) ──────────────────
	const handleMessage = useCallback(
		(e: MessageEvent) => {
			const message: ExtensionMessage = e.data
			// Play sound for interactionRequired — the store can't access useSound hook
			if (message.type === "interactionRequired") {
				playSound("notification")
			}
			rootStore.handleExtensionMessage(e)
		},
		[playSound],
	)

	useEvent("message", handleMessage)

	const placeholderText = currentTaskItem ? t("chat:typeMessage") : t("chat:typeTask")

	// ── Mode Switching ────────────────────────────────────────────
	const switchToMode = useCallback(
		(modeSlug: string): void => {
			setMode(modeSlug)
			store.switchMode(modeSlug)
		},
		[setMode, store],
	)

	const switchToNextMode = useCallback(() => {
		const allModes = getAllModes(customModes)
		const currentModeIndex = allModes.findIndex((m) => m.slug === mode)
		const nextModeIndex = (currentModeIndex + 1) % allModes.length
		switchToMode(allModes[nextModeIndex].slug)
	}, [mode, customModes, switchToMode])

	const switchToPreviousMode = useCallback(() => {
		const allModes = getAllModes(customModes)
		const currentModeIndex = allModes.findIndex((m) => m.slug === mode)
		const previousModeIndex = (currentModeIndex - 1 + allModes.length) % allModes.length
		switchToMode(allModes[previousModeIndex].slug)
	}, [mode, customModes, switchToMode])

	// ── Keyboard Shortcuts ────────────────────────────────────────
	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key === ".") {
				event.preventDefault()
				if (event.shiftKey) switchToPreviousMode()
				else switchToNextMode()
			}
		},
		[switchToNextMode, switchToPreviousMode],
	)

	useEffect(() => {
		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [handleKeyDown])

	// ── Imperative Handle ─────────────────────────────────────────
	useImperativeHandle(ref, () => ({
		acceptInput: () => {
			const hasInput = ui.inputValue.trim() || ui.selectedImages.length > 0
			if (ui.clineAsk === "command_output" && hasInput) {
				const images = ui.selectedImages.slice()
				store.queueMessage(ui.inputValue.trim(), images)
				ui.clearInput()
				return
			}
			if (ui.enableButtons && ui.primaryButtonText) {
				store.handlePrimaryButtonClick(
					ui.clineAsk ?? undefined,
					currentTaskItem,
					[],
					ui.inputValue,
					ui.selectedImages.slice(),
				)
			} else if (!ui.sendingDisabled && !isProfileDisabled && hasInput) {
				handleSendMessage(ui.inputValue, ui.selectedImages)
			}
		},
	}))

	// ── Render ────────────────────────────────────────────────────
	if (!currentTaskItem) {
		return <HomeScreen openUpsell={openUpsell} />
	}

	return (
		<div data-testid="chat-view" className="fixed top-0 left-0 right-0 bottom-0 flex flex-col overflow-hidden">
			{telemetrySetting === "unset" && <TelemetryBanner />}
			{(showAnnouncement || ui.showAnnouncementModal) && (
				<Announcement
					hideAnnouncement={() => {
						if (ui.showAnnouncementModal) ui.setShowAnnouncementModal(false)
						if (showAnnouncement) hideAnnouncement()
					}}
				/>
			)}
			<ChatArea isHidden={isHidden} />
			<QueuedMessages
				queue={messageQueue}
				onRemove={(index) => {
					if (messageQueue[index]) store.removeQueuedMessage(messageQueue[index].id)
				}}
				onUpdate={(index, newText) => {
					if (messageQueue[index])
						store.editQueuedMessage(messageQueue[index].id, newText, messageQueue[index].images)
				}}
			/>
			{ui.showRetiredProviderWarning && (
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
				onSend={() => handleSendMessage(ui.inputValue, ui.selectedImages.slice())}
				onSelectImages={selectImages}
				shouldDisableImages={shouldDisableImages}
				onHeightChange={() => {
					// Scroll-to-bottom on height change is handled inside ChatArea via useScrollLifecycle
				}}
				modeShortcutText={modeShortcutText}
				isStreaming={isStreaming}
				onStop={handleStopTask}
				onEnqueueMessage={handleEnqueueCurrentMessage}
			/>
			{isProfileDisabled && (
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
