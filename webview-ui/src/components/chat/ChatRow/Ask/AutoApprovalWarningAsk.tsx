import React from "react"
import type { ClineMessage } from "@jabberwock/types"
import { AutoApprovedRequestLimitWarning } from "../../AutoApprovedRequestLimitWarning"

interface AutoApprovalWarningAskProps {
	message: ClineMessage
}

export const AutoApprovalWarningAsk: React.FC<AutoApprovalWarningAskProps> = ({ message }) => (
	<AutoApprovedRequestLimitWarning message={message} />
)
