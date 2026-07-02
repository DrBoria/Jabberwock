import React from "react"
import type { Notification } from "@jabberwock/types"
import { AutoApprovedRequestLimitWarning } from "@src/features/chat/task/notifications/auto-approved-request-limit-warning"

interface AutoApprovalWarningAskProps {
	message: Notification
}

export const AutoApprovalWarningAsk: React.FC<AutoApprovalWarningAskProps> = ({ message }) => (
	<AutoApprovedRequestLimitWarning message={message} />
)
