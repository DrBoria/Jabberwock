import React from "react"
import { observer } from "mobx-react-lite"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "@src/components/ui/button"
import { StandardTooltip } from "@src/components/ui/standard-tooltip"
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
const AskResponderComponent: React.FC<AskResponderProps> = ({ onPrimaryClick, onSecondaryClick, onScrollToBottom }) => {
	const { t } = useAppTranslation()
	const ui = useChatUI()
	const { primaryButtonText, secondaryButtonText, enableButtons, showScrollToBottom } = ui

	if (!showScrollToBottom && !primaryButtonText && !secondaryButtonText) return null

	return (
		<div
			className={`flex h-9 items-center mb-1 px-[15px] ${
				showScrollToBottom ? "opacity-100" : enableButtons ? "opacity-100" : "opacity-50"
			}`}>
			{showScrollToBottom && !enableButtons ? (
				<StandardTooltip content={t("chat:scrollToBottom")}>
					<Button variant="secondary" className="flex-[2]" onClick={onScrollToBottom}>
						<span className="codicon codicon-chevron-down" />
					</Button>
				</StandardTooltip>
			) : (
				<>
					{primaryButtonText && (
						<StandardTooltip
							content={tooltipMap[primaryButtonText] ? t(tooltipMap[primaryButtonText]) : undefined}>
							<Button
								data-agent-action="continue-task"
								variant="primary"
								disabled={!enableButtons}
								className={secondaryButtonText ? "flex-1 mr-[6px]" : "flex-[2] mr-0"}
								onClick={() => onPrimaryClick()}>
								{primaryButtonText}
							</Button>
						</StandardTooltip>
					)}
					{secondaryButtonText && (
						<StandardTooltip
							content={tooltipMap[secondaryButtonText] ? t(tooltipMap[secondaryButtonText]) : undefined}>
							<Button
								data-agent-action="reject-task"
								variant="secondary"
								disabled={!enableButtons}
								className="flex-1 ml-[6px]"
								onClick={() => onSecondaryClick()}>
								{secondaryButtonText}
							</Button>
						</StandardTooltip>
					)}
				</>
			)}
		</div>
	)
}

export const AskResponder = observer(AskResponderComponent)
