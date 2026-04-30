import React from "react"
import type { ClineMessage } from "@jabberwock/types"
import { safeJsonParse } from "@shared/core"
import { Markdown } from "../../Markdown"
import { FollowUpSuggest } from "../../FollowUpSuggest"
import { Container } from "@src/components/ui"

interface FollowUpAskProps {
	message: ClineMessage
	icon: React.ReactNode
	title: React.ReactNode
	onSuggestionClick?: (suggestion: any, event?: React.MouseEvent) => void
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
			return safeJsonParse<any>(message.text)
		}
		return null
	}, [message.type, message.ask, message.partial, message.text])

	return (
		<>
			{title && (
				<Container preset="header" p="0">
					{icon}
					{title}
				</Container>
			)}
			<Container preset="col" ml="24px" gap="8px">
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
