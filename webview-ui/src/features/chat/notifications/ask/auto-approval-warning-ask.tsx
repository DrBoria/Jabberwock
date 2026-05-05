import React from "react"
import type { ClineMessage } from "@jabberwock/types"
import { AutoApprovedRequestLimitWarning } from "@src/features/chat/notifications/auto-approved-request-limit-warning"

interface AutoApprovalWarningAskProps {
	message: ClineMessage
}

export const AutoApprovalWarningAsk: React.FC<AutoApprovalWarningAskProps> = ({ message }) => (
	<AutoApprovedRequestLimitWarning message={message} />
)
