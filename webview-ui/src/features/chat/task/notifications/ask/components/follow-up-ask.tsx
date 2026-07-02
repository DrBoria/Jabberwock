import React from "react"
import type { Notification, SuggestionItem } from "@jabberwock/types"
import { safeJsonParse } from "@jabberwock/core/browser"
import { Markdown } from "../../../messages/components/message-parts/markdown"
import { FollowUpSuggest } from "@src/features/chat/task/notifications/follow-up-suggest"
import { Container } from "@src/shared/ui/layouts/Container"

interface FollowUpAskProps {
	message: Notification
	icon: React.ReactNode
	title: React.ReactNode
	onSuggestionClick?: (suggestion: SuggestionItem, event?: React.MouseEvent) => void
	onFollowUpUnmount?: () => void
	isFollowUpAnswered?: boolean
	isFollowUpAutoApprovalPaused?: boolean
}

export const FollowUpAsk: React.FC<FollowUpAskProps> = ({
	message,
	icon,
	title,
	onSuggestionClick,
	onFollowUpUnmount,
	isFollowUpAnswered,
	isFollowUpAutoApprovalPaused,
}) => {
	const followUpData = React.useMemo(() => {
		if (message.type === "ask" && message.ask === "followup" && !message.partial) {
			return safeJsonParse<{ question: string; suggest: SuggestionItem[] }>(message.text)
		}
		return null
	}, [message.type, message.ask, message.partial, message.text])

	return (
		<>
			{title && (
				<Container $preset="header" $p="0">
					{icon}
					{title}
				</Container>
			)}
			<Container $preset="col" $ml="24px" $gap="8px">
				<Markdown markdown={message.partial === true ? message?.text : followUpData?.question} />
				<FollowUpSuggest
					suggestions={followUpData?.suggest}
					onSuggestionClick={onSuggestionClick}
					ts={message?.ts}
					onCancelAutoApproval={onFollowUpUnmount}
					isAnswered={isFollowUpAnswered}
					isFollowUpAutoApprovalPaused={isFollowUpAutoApprovalPaused}
				/>
			</Container>
		</>
	)
}
