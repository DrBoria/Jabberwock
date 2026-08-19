import React from "react"
import { ErrorRow } from "../../row/error-rows/error-row"
import { Container } from "@src/shared/ui/layouts/Container"
import { headerStyle } from "@src/features/foundation/ui/utils/header-style"
import { getPowerShellDocsUrl } from "./apiReqSay.utils"

const ApiReqErrorRow: React.FC<{
	apiRequestFailedMessage: string | undefined
	apiReqStreamingFailedMessage: string | undefined
}> = ({ apiRequestFailedMessage, apiReqStreamingFailedMessage }) => {
	const errorMessage = apiRequestFailedMessage || apiReqStreamingFailedMessage
	if (!errorMessage) return null

	return (
		<ErrorRow
			type="api_failure"
			message={errorMessage || ""}
			docsURL={getPowerShellDocsUrl(apiRequestFailedMessage)}
			errorDetails={apiReqStreamingFailedMessage}
		/>
	)
}

interface ApiReqStartedContentProps {
	cost: number | undefined
	apiRequestFailedMessage: string | undefined
	apiReqStreamingFailedMessage: string | undefined
	isApiRequestInProgress: boolean
	icon: React.ReactNode
	title: React.ReactNode
}

const ApiReqStartedContent: React.FC<ApiReqStartedContentProps> = ({
	cost,
	apiRequestFailedMessage,
	apiReqStreamingFailedMessage,
	isApiRequestInProgress,
	icon,
	title,
}) => {
	const noCost = cost === undefined
	const hasFailedButNoCost = cost == null && apiRequestFailedMessage
	const shouldShowError = hasFailedButNoCost || apiReqStreamingFailedMessage
	const showCost = cost != null && cost > 0
	const containerMarginBottom = shouldShowError ? 10 : 0
	const containerOpacity = isApiRequestInProgress && noCost ? 1 : 0.4
	const costDisplayOpacity = showCost ? 1 : 0
	const displayCost = Number(cost ?? 0).toFixed(4)

	return (
		<>
			<Container
				$preset="header-cost"
				$theme="default"
				$p="0"
				style={{
					...headerStyle,
					marginBottom: containerMarginBottom,
					opacity: containerOpacity,
				}}
				className="group text-sm transition-opacity hover:opacity-100">
				{icon}
				{title}
				<div
					className="text-xs text-vscode-dropdown-foreground border-vscode-dropdown-border/50 border px-1.5 py-0.5 rounded-lg"
					style={{ opacity: costDisplayOpacity }}>
					${displayCost}
				</div>
			</Container>
			<ApiReqErrorRow
				apiRequestFailedMessage={apiRequestFailedMessage}
				apiReqStreamingFailedMessage={apiReqStreamingFailedMessage}
			/>
		</>
	)
}

export default ApiReqStartedContent
