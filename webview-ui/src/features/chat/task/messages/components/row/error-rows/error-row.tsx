import React, { useState } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"

import { rootStore } from "@src/features/store"
import { useSelectedModel } from "@src/features/foundation/ui/hooks/useSelectedModel/useSelectedModel"
import { PROVIDERS } from "@src/features/settings/components/shared/constants"

import { DiffErrorRow } from "./error-row-components"
import { ErrorRowStandard } from "./error-row-standard"

export interface ErrorRowProps {
	type:
		| "error"
		| "mistake_limit"
		| "api_failure"
		| "diff_error"
		| "streaming_failed"
		| "cancelled"
		| "api_req_retry_delayed"
	title?: string
	message: string
	showCopyButton?: boolean
	expandable?: boolean
	defaultExpanded?: boolean
	additionalContent?: React.ReactNode
	headerClassName?: string
	messageClassName?: string
	code?: number
	docsURL?: string
	errorDetails?: string
}

function getDefaultTitle(
	type: ErrorRowProps["type"],
	title: string | undefined,
	code: number | undefined,
	t: ReturnType<typeof useTranslation>["t"],
): string | null {
	if (title) return title
	switch (type) {
		case "error":
			return t("chat:error")
		case "mistake_limit":
			return t("chat:troubleMessage")
		case "api_failure":
			return t("chat:apiRequest.failed")
		case "api_req_retry_delayed":
			return t("chat:apiRequest.errorTitle", { code: code ? ` · ${code}` : "" })
		case "streaming_failed":
			return t("chat:apiRequest.streamingFailed")
		case "cancelled":
			return t("chat:apiRequest.cancelled")
		case "diff_error":
			return t("chat:diffError.title")
		default:
			return null
	}
}

export const ErrorRow = observer(
	({
		type,
		title,
		message,
		showCopyButton = false,
		expandable = false,
		defaultExpanded = false,
		additionalContent,
		headerClassName,
		messageClassName,
		docsURL,
		code,
		errorDetails,
	}: ErrorRowProps) => {
		const { t } = useTranslation()
		const [isExpanded, setIsExpanded] = useState(defaultExpanded)
		const version = rootStore.extensionState.version
		const apiConfiguration = rootStore.extensionState.apiConfiguration
		const { provider, id: modelId } = useSelectedModel(apiConfiguration)
		const usesProxy = PROVIDERS.find((p) => p.value === provider)?.proxy ?? false
		const errorTitle = getDefaultTitle(type, title, code, t)

		if (type === "diff_error" && expandable)
			return (
				<DiffErrorRow
					errorTitle={errorTitle}
					message={message}
					showCopyButton={showCopyButton}
					isExpanded={isExpanded}
					onToggleExpand={() => setIsExpanded(!isExpanded)}
				/>
			)

		return (
			<ErrorRowStandard
				errorTitle={errorTitle}
				message={message}
				messageClassName={messageClassName}
				headerClassName={headerClassName}
				docsURL={docsURL}
				additionalContent={additionalContent}
				errorDetails={errorDetails}
				version={version}
				provider={provider}
				modelId={modelId}
				usesProxy={usesProxy}
			/>
		)
	},
)

export default ErrorRow
