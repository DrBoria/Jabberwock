import React from "react"
import { ChevronDown } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "@src/shared/ui/buttons/button"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"
import { useChatUI } from "@src/features/chat/store"

export interface AskResponderProps {
	onPrimaryClick: () => void
	onSecondaryClick: () => void
	onScrollToBottom: () => void
}

const tooltipMap: Record<string, string> = {
	"chat:retry.title": "chat:retry.tooltip",
	"chat:save.title": "chat:save.tooltip",
	"chat:approve.title": "chat:approve.tooltip",
	"chat:runCommand.title": "chat:runCommand.tooltip",
	"chat:startNewTask.title": "chat:startNewTask.tooltip",
	"chat:resumeTask.title": "chat:resumeTask.tooltip",
	"chat:proceedAnyways.title": "chat:proceedAnyways.tooltip",
	"chat:proceedWhileRunning.title": "chat:proceedWhileRunning.tooltip",
}

/**
 * Renders the primary/secondary action button bar below the chat.
 * Shows scroll-to-bottom button when user has scrolled up,
 * or approve/reject/continue buttons when the AI is asking.
 * Reads button state from ChatUIStore (synced by view.tsx).
 */
const AskButton = ({
	text,
	onClick,
	variant,
	className,
	enableButtons,
}: {
	text: string | undefined
	onClick: () => void
	variant: "primary" | "secondary"
	className: string
	enableButtons: boolean
}) => {
	const { t } = useAppTranslation()
	if (!text) return null
	return (
		<StandardTooltip content={tooltipMap[text] ? t(tooltipMap[text]) : undefined}>
			<Button
				data-agent-action={variant === "primary" ? "continue-task" : "reject-task"}
				variant={variant}
				disabled={!enableButtons}
				className={className}
				onClick={() => onClick()}>
				{text}
			</Button>
		</StandardTooltip>
	)
}

const ScrollButton = ({ onScrollToBottom }: { onScrollToBottom: () => void }) => {
	const { t } = useAppTranslation()
	return (
		<StandardTooltip content={t("chat:scrollToBottom")}>
			<Button variant="secondary" className="flex-[2]" onClick={onScrollToBottom}>
				<ChevronDown className="w-4 h-4" />
			</Button>
		</StandardTooltip>
	)
}

const AskResponderComponent: React.FC<AskResponderProps> = ({ onPrimaryClick, onSecondaryClick, onScrollToBottom }) => {
	const ui = useChatUI()
	const { primaryButtonText, secondaryButtonText, enableButtons, showScrollToBottom } = ui

	const hasNoButtons = !primaryButtonText && !secondaryButtonText
	const hasNoScroll = !showScrollToBottom
	if (hasNoScroll && hasNoButtons) return null

	const containerOpacity = enableButtons || showScrollToBottom ? "opacity-100" : "opacity-50"

	if (showScrollToBottom && !enableButtons) {
		return (
			<div className={`flex h-9 items-center mb-1 px-[15px] ${containerOpacity}`}>
				<ScrollButton onScrollToBottom={onScrollToBottom} />
			</div>
		)
	}

	return (
		<div className={`flex h-9 items-center mb-1 px-[15px] ${containerOpacity}`}>
			<AskButton
				text={primaryButtonText}
				onClick={onPrimaryClick}
				variant="primary"
				enableButtons={enableButtons}
				className={secondaryButtonText ? "flex-1 mr-[6px]" : "flex-[2] mr-0"}
			/>
			<AskButton
				text={secondaryButtonText}
				onClick={onSecondaryClick}
				variant="secondary"
				enableButtons={enableButtons}
				className="flex-1 ml-[6px]"
			/>
		</div>
	)
}

export const AskResponder = observer(AskResponderComponent)
