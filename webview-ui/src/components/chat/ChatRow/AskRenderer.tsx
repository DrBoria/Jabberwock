import React from "react"
import type { ClineMessage } from "@jabberwock/types"
import {
	UseMcpServerAsk,
	InteractiveAppAsk,
	CompletionResultAsk,
	FollowUpAsk,
	MistakeLimitAsk,
	CommandAsk,
	AutoApprovalWarningAsk,
} from "./Ask"

interface AskRendererProps {
	message: ClineMessage
	icon: React.ReactNode
	title: React.ReactNode
	isLast: boolean
	lastModifiedMessage?: ClineMessage
	onSuggestionClick?: (suggestion: any, event?: React.MouseEvent) => void
	onFollowUpUnmount?: () => void
	isFollowUpAnswered?: boolean
	isFollowUpAutoApprovalPaused?: boolean
	t: (key: string, options?: any) => string
}

/** Main AskRenderer - dispatches to sub-renderers via object-literal pattern */
export const AskRenderer: React.FC<AskRendererProps> = (props) => {
	const {
		message,
		icon,
		title,
		onSuggestionClick,
		onFollowUpUnmount,
		isFollowUpAnswered,
		isFollowUpAutoApprovalPaused,
		t,
	} = props

	const dispatchers: Record<string, () => React.ReactNode> = {
		mistake_limit_reached: () => <MistakeLimitAsk message={message} />,
		command: () => <CommandAsk message={message} icon={icon} title={title} />,
		use_mcp_server: () => <UseMcpServerAsk message={message} icon={icon} title={title} t={t} />,
		interactive_app: () => <InteractiveAppAsk message={message} icon={icon} title={title} t={t} />,
		completion_result: () => <CompletionResultAsk message={message} icon={icon} title={title} />,
		followup: () => (
			<FollowUpAsk
				message={message}
				icon={icon}
				title={title}
				onSuggestionClick={onSuggestionClick}
				onFollowUpUnmount={onFollowUpUnmount}
				isFollowUpAnswered={isFollowUpAnswered}
				isFollowUpAutoApprovalPaused={isFollowUpAutoApprovalPaused}
			/>
		),
		auto_approval_max_req_reached: () => <AutoApprovalWarningAsk message={message} />,
	}

	return dispatchers[message.ask ?? ""]?.() ?? null
}
