import React from "react"
import type { Notification } from "@jabberwock/types"
import { ErrorRow } from "@src/features/chat/task/messages/components/row/error-rows/main"

interface MistakeLimitAskProps {
	message: Notification
}

export const MistakeLimitAsk: React.FC<MistakeLimitAskProps> = ({ message }) => (
	<ErrorRow type="mistake_limit" message={message.text || ""} errorDetails={message.text} />
)
