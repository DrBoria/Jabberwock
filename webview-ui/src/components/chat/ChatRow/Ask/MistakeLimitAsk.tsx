import React from "react"
import type { ClineMessage } from "@jabberwock/types"
import { ErrorRow } from "../../ErrorRow"

interface MistakeLimitAskProps {
	message: ClineMessage
}

export const MistakeLimitAsk: React.FC<MistakeLimitAskProps> = ({ message }) => (
	<ErrorRow type="mistake_limit" message={message.text || ""} errorDetails={message.text} />
)
