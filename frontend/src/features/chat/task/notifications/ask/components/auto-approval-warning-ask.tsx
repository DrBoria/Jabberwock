import React from "react"
import type { Notification } from "@jabberwock/types"
import { AutoApprovedRequestLimitWarning } from "@src/features/chat"

interface AutoApprovalWarningAskProps {
	message: Notification
}

export const AutoApprovalWarningAsk: React.FC<AutoApprovalWarningAskProps> = ({ message }) => (
	<AutoApprovedRequestLimitWarning message={message} />
)
