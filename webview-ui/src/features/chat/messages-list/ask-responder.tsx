import React from "react"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "@src/components/ui/button"
import { StandardTooltip } from "@src/components/ui/standard-tooltip"

export interface AskResponderProps {
	primaryButtonText: string | undefined
	secondaryButtonText: string | undefined
	enableButtons: boolean
	showScrollToBottom: boolean
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
 */
export const AskResponder: React.FC<AskResponderProps> = ({
	primaryButtonText,
	secondaryButtonText,
	enableButtons,
	showScrollToBottom,
	onPrimaryClick,
	onSecondaryClick,
	onScrollToBottom,
}) => {
	const { t } = useAppTranslation()

	if (!showScrollToBottom && !primaryButtonText && !secondaryButtonText) return null

	return (
		<div
			className={`flex h-9 items-center mb-1 px-[15px] ${
				showScrollToBottom ? "opacity-100" : enableButtons ? "opacity-100" : "opacity-50"
			}`}>
			{showScrollToBottom ? (
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
