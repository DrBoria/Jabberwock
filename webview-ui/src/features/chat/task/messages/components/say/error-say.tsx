import React from "react"
import type { Notification } from "@jabberwock/types"
import { ErrorRow } from "../row/error-rows/error-row"

interface ErrorSayProps {
	message: Notification
	t: (key: string, options?: Record<string, unknown>) => string
}

/** Renders error say messages with object-lookup for known error types */
export const ErrorSay: React.FC<ErrorSayProps> = ({ message, t }) => {
	const isNoToolsUsedError = message.text === "MODEL_NO_TOOLS_USED"
	const isNoAssistantMessagesError = message.text === "MODEL_NO_ASSISTANT_MESSAGES"

	if (isNoToolsUsedError) {
		return (
			<ErrorRow
				type="error"
				title={t("chat:modelResponseIncomplete")}
				message={t("chat:modelResponseErrors.noToolsUsed")}
				errorDetails={t("chat:modelResponseErrors.noToolsUsedDetails")}
			/>
		)
	}
	if (isNoAssistantMessagesError) {
		return (
			<ErrorRow
				type="error"
				title={t("chat:modelResponseIncomplete")}
				message={t("chat:modelResponseErrors.noAssistantMessages")}
				errorDetails={t("chat:modelResponseErrors.noAssistantMessagesDetails")}
			/>
		)
	}
	return <ErrorRow type="error" message={message.text || t("chat:error")} errorDetails={message.text} />
}
