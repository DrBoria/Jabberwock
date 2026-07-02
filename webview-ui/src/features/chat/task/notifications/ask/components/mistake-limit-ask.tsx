import React from "react"
import type { Notification } from "@jabberwock/types"
import { ErrorRow } from "../../../messages/components/row/error-rows/error-row"

interface MistakeLimitAskProps {
	message: Notification
}

export const MistakeLimitAsk: React.FC<MistakeLimitAskProps> = ({ message }) => (
	<ErrorRow type="mistake_limit" message={message.text || ""} errorDetails={message.text} />
)
