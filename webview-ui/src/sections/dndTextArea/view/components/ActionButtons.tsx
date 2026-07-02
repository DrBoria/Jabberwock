import React from "react"
import { Image, WandSparkles, SendHorizontal, X, ListEnd, Square } from "lucide-react"
import { cn } from "@src/lib/utils"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"
import { Button } from "@src/shared/ui/buttons/button"
import { Container } from "@src/shared/ui/layouts/Container"
import type { ActionButtonsProps } from "../types"

const ImageAddButton: React.FC<{
	shouldDisableImages: boolean
	onSelectImages: () => void
	t: (key: string, params?: Record<string, string>) => string
}> = ({ shouldDisableImages, onSelectImages, t }) => (
	<StandardTooltip content={t("chat:addImages")}>
		<Button
			variant={shouldDisableImages ? "iconButtonDisabled" : "iconButtonMuted"}
			size="icon"
			aria-label={t("chat:addImages")}
			disabled={shouldDisableImages}
			onClick={!shouldDisableImages ? onSelectImages : undefined}>
			<Image className="w-4 h-4" />
		</Button>
	</StandardTooltip>
)

const CancelEnhanceButton: React.FC<{
	isEditMode: boolean
	onCancel?: () => void
	hasContent: boolean
	handleEnhancePrompt: () => void
	isEnhancingPrompt: boolean
	t: (key: string, params?: Record<string, string>) => string
}> = ({ isEditMode, onCancel, hasContent, handleEnhancePrompt, isEnhancingPrompt, t }) => {
	if (isEditMode) {
		return (
			<StandardTooltip content={t("chat:cancel.title")}>
				<Button variant="iconButton" size="icon" aria-label={t("chat:cancel.title")} onClick={onCancel}>
					<X className="w-4 h-4" />
				</Button>
			</StandardTooltip>
		)
	}

	return (
		<StandardTooltip content={t("chat:enhancePrompt")}>
			<Button
				variant={hasContent ? "iconButtonMuted" : "iconButton"}
				size="icon"
				aria-label={t("chat:enhancePrompt")}
				onClick={handleEnhancePrompt}
				className={cn(!hasContent && "opacity-0 pointer-events-none duration-200 delay-0")}>
				<WandSparkles className={cn("w-4 h-4", isEnhancingPrompt && "animate-spin")} />
			</Button>
		</StandardTooltip>
	)
}

const EnqueueButton: React.FC<{
	onEnqueueMessage?: () => void
	t: (key: string, params?: Record<string, string>) => string
}> = ({ onEnqueueMessage, t }) => (
	<StandardTooltip content={t("chat:enqueueMessage")}>
		<Button variant="iconButton" size="icon" aria-label={t("chat:enqueueMessage")} onClick={onEnqueueMessage}>
			<ListEnd className="w-4 h-4" />
		</Button>
	</StandardTooltip>
)

const SendButton: React.FC<{
	isStreaming: boolean
	isEditMode: boolean
	isSendVisible: boolean
	sendKeyCombination: string
	onStop?: () => void
	onSend: () => void
	t: (key: string, params?: Record<string, string>) => string
}> = ({ isStreaming, isEditMode, isSendVisible, sendKeyCombination, onStop, onSend, t }) => {
	const tooltipContent = isEditMode
		? t("chat:pressToSend", { keyCombination: sendKeyCombination })
		: isStreaming
			? t("chat:stop.title")
			: t("chat:pressToSend", { keyCombination: sendKeyCombination })

	const ariaLabel = isEditMode
		? t("chat:pressToSend", { keyCombination: sendKeyCombination })
		: isStreaming
			? t("chat:stop.title")
			: t("chat:pressToSend", { keyCombination: sendKeyCombination })

	return (
		<StandardTooltip content={tooltipContent}>
			<Button
				variant={isStreaming ? "stopButton" : "sendButton"}
				size="icon"
				data-agent-action={isStreaming ? "cancel-task" : "send-message"}
				data-testid="submit-button"
				aria-label={ariaLabel}
				onClick={isStreaming ? onStop : onSend}
				className={cn(isSendVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none")}>
				{isStreaming ? (
					<Square className="size-4 stroke-none fill-vscode-button-foreground" />
				) : (
					<SendHorizontal className="size-4" />
				)}
			</Button>
		</StandardTooltip>
	)
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
	isEditMode,
	isStreaming,
	shouldDisableImages,
	hasContent,
	onSelectImages,
	onCancel,
	handleEnhancePrompt,
	isEnhancingPrompt,
	onEnqueueMessage,
	sendKeyCombination,
	isSendVisible,
	onSend,
	onStop,
	t,
}) => (
	<Container className="absolute bottom-2 right-1 z-30 flex flex-col items-center gap-0">
		<ImageAddButton shouldDisableImages={shouldDisableImages} onSelectImages={onSelectImages} t={t} />
		<CancelEnhanceButton
			isEditMode={isEditMode}
			onCancel={onCancel}
			hasContent={hasContent}
			handleEnhancePrompt={handleEnhancePrompt}
			isEnhancingPrompt={isEnhancingPrompt}
			t={t}
		/>
		{!isEditMode && isStreaming && hasContent && onEnqueueMessage && (
			<EnqueueButton onEnqueueMessage={onEnqueueMessage} t={t} />
		)}
		<SendButton
			isStreaming={isStreaming}
			isEditMode={isEditMode}
			isSendVisible={isSendVisible}
			sendKeyCombination={sendKeyCombination}
			onStop={onStop}
			onSend={onSend}
			t={t}
		/>
	</Container>
)
