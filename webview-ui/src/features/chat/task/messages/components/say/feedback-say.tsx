import React from "react"
import { User, Edit, Trash2 } from "lucide-react"
import type { Notification, SayToolData } from "@jabberwock/types"
import { safeJsonParse } from "@shared/core"
import { observer } from "mobx-react-lite"
import { useSelectedModel } from "@src/features/foundation/ui/hooks/useSelectedModel"
import { rootStore } from "@src/features/store"
import { useChatUI } from "@src/features/chat/store"
import { ChatTextArea } from "../../../../text-area/view"
import { Mention } from "../../../../text-area/mention/mention"
import Thumbnails from "@src/features/foundation/components/Thumbnails"
import CodeAccordion from "@src/features/foundation/components/CodeAccordion"
import { Container } from "@src/features/foundation/ui"
import { MAX_ATTACHED_IMAGES } from "../constants"
import type { Mode } from "@shared/modes"

interface UserFeedbackProps {
	message: Notification
	isStreaming: boolean
	t: (key: string, options?: Record<string, unknown>) => string
}

/** Renders user_feedback say messages with edit capability */
export const UserFeedbackSay: React.FC<UserFeedbackProps> = observer(({ message, isStreaming, t }) => {
	const apiConfiguration = rootStore.extensionState.apiConfiguration
	const mode = rootStore.extensionState.mode
	const { info: model } = useSelectedModel(apiConfiguration)
	const ui = useChatUI()
	const [isEditing, setIsEditing] = React.useState(false)
	const [savedStoreState, setSavedStoreState] = React.useState<{
		inputValue: string
		selectedImages: string[]
		mode: Mode
	} | null>(null)

	React.useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const msg = event.data
			if (msg.type === "selectedImages" && msg.context === "edit" && msg.messageTs === message.ts && isEditing) {
				ui.appendSelectedImages(msg.images.slice(0, MAX_ATTACHED_IMAGES - ui.selectedImages.length))
			}
		}
		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [isEditing, message.ts, ui])

	const handleEditClick = React.useCallback(() => {
		setSavedStoreState({
			inputValue: ui.inputValue,
			selectedImages: ui.selectedImages,
			mode: mode || "code",
		})
		ui.setInputValue(message.text || "")
		ui.setSelectedImages(message.images || [])
		setIsEditing(true)
	}, [message.text, message.images, mode, ui])

	const handleCancelEdit = React.useCallback(() => {
		if (savedStoreState) {
			ui.setInputValue(savedStoreState.inputValue)
			ui.setSelectedImages(savedStoreState.selectedImages)
			setSavedStoreState(null)
		}
		setIsEditing(false)
	}, [savedStoreState, ui])

	const handleSaveEdit = React.useCallback(() => {
		if (savedStoreState) {
			ui.setInputValue(savedStoreState.inputValue)
			ui.setSelectedImages(savedStoreState.selectedImages)
			setSavedStoreState(null)
		}
		setIsEditing(false)
		const images = ui.selectedImages.slice()
		rootStore.chat.submitEditedMessage(message.ts, ui.inputValue, images)
	}, [message.ts, ui, savedStoreState])

	const handleSelectImages = React.useCallback(() => {
		rootStore.chat.selectImagesForEdit("edit", message.ts)
	}, [message.ts])

	return (
		<div className="group">
			<Container $preset="header" $p="0">
				<User className="w-4 shrink-0" aria-label="User icon" />
				<span style={{ fontWeight: "bold" }}>{t("chat:feedback.youSaid")}</span>
			</Container>
			<Container
				$preset="col"
				$ml="24px"
				$theme={isEditing ? "card" : "subtle"}
				$p={isEditing ? "8px" : "4px 4px"}
				$gap="0"
				style={{
					borderRadius: "3px",
					overflow: "hidden",
					whiteSpace: "pre-wrap",
					cursor: isEditing ? "default" : "text",
				}}>
				{isEditing ? (
					<ChatTextArea
						placeholderText={t("chat:editMessage.placeholder")}
						onSend={handleSaveEdit}
						onSelectImages={handleSelectImages}
						shouldDisableImages={!model?.supportsImages}
						modeShortcutText=""
						isEditMode={true}
						onCancel={handleCancelEdit}
					/>
				) : (
					<Container $preset="row" $gap="0" style={{ gridTemplateColumns: "1fr auto" }}>
						<div
							style={{ padding: "4px 8px" }}
							onClick={(e) => {
								e.stopPropagation()
								if (!isStreaming) handleEditClick()
							}}
							title={t("chat:queuedMessages.clickToEdit")}>
							<Mention text={message.text} withShadow />
						</div>
						<Container $preset="row" $gap="4px" $p="0 4px 0 0">
							<div
								className="cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
								style={{ visibility: isStreaming ? "hidden" : "visible" }}
								onClick={(e) => {
									e.stopPropagation()
									handleEditClick()
								}}>
								<Edit className="w-4" aria-label="Edit message icon" />
							</div>
							<div
								className="cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
								style={{ visibility: isStreaming ? "hidden" : "visible" }}
								onClick={(e) => {
									e.stopPropagation()
									rootStore.chat.deleteMessage(message.ts)
								}}>
								<Trash2 className="w-4" aria-label="Delete message icon" />
							</div>
						</Container>
					</Container>
				)}
				{!isEditing && message.images && message.images.length > 0 && (
					<Thumbnails images={message.images} style={{ marginTop: "8px" }} />
				)}
			</Container>
		</div>
	)
})

interface UserFeedbackDiffProps {
	message: Notification
	isExpanded: boolean
	onToggleExpand: () => void
}

/** Renders user_feedback_diff say messages */
export const UserFeedbackDiffSay: React.FC<UserFeedbackDiffProps> = ({ message, isExpanded, onToggleExpand }) => {
	const tool = safeJsonParse<SayToolData>(message.text)
	return (
		<div style={{ marginTop: -10, width: "100%" }}>
			<CodeAccordion
				code={tool?.diff}
				language="diff"
				isFeedback={true}
				isExpanded={isExpanded}
				onToggleExpand={onToggleExpand}
			/>
		</div>
	)
}
