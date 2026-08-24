import React from "react"
import { Repeat2 } from "lucide-react"
import type { Notification } from "@jabberwock/types"
import { cn } from "@/lib/utils"
import { ErrorRow } from "../../row/error-rows/error-row"
import { ProgressIndicator } from "../../message-parts/progress-indicator"
import { Container } from "@src/shared/ui/layouts/Container"
import { parseApiReqData, getApiRequestFailedMessage, parseStatusCode, parseRetryTimer } from "./apiReqSay.utils"
import { headerStyle } from "@src/features/foundation/ui/utils/header-style"
import ApiReqStartedContent from "./ApiReqStartedContent"

interface ApiReqStartedProps {
	message: Notification
	isLast: boolean
	lastModifiedMessage?: Notification
	icon: React.ReactNode
	title: React.ReactNode
	t: (key: string, options?: Record<string, unknown>) => string
}

/** Renders api_req_started say messages */
export const ApiReqStartedSay: React.FC<ApiReqStartedProps> = ({
	message,
	isLast,
	lastModifiedMessage,
	icon,
	title,
	t: _t,
}) => {
	const {
		cost,
		cancelReason: apiReqCancelReason,
		streamingFailedMessage: apiReqStreamingFailedMessage,
	} = React.useMemo(() => parseApiReqData(message.text), [message.text])

	const apiRequestFailedMessage = getApiRequestFailedMessage(isLast, lastModifiedMessage)
	const isApiRequestInProgress = apiReqCancelReason === undefined && apiRequestFailedMessage === undefined

	return (
		<ApiReqStartedContent
			cost={cost}
			apiRequestFailedMessage={apiRequestFailedMessage}
			apiReqStreamingFailedMessage={apiReqStreamingFailedMessage}
			isApiRequestInProgress={isApiRequestInProgress}
			icon={icon}
			title={title}
		/>
	)
}

interface ApiReqRetryDelayedProps {
	message: Notification
	t: (key: string, options?: Record<string, unknown>) => string
	i18n: { exists: (key: string) => boolean }
}

/** Renders api_req_retry_delayed say messages */
export const ApiReqRetryDelayedSay: React.FC<ApiReqRetryDelayedProps> = ({ message, t, i18n }) => {
	if (message.text === undefined) {
		return <ErrorRow type="api_req_retry_delayed" message={t("chat:apiRequest.failed")} />
	}

	const { body, code, docsURL } = parseStatusCode(message.text, i18n, t)
	const { rawError, retryTimer } = parseRetryTimer(message.text)
	const retryInfo = retryTimer > 0 && (
		<p
			className={cn(
				"mt-2 font-light text-xs text-vscode-descriptionForeground cursor-default flex items-center gap-1 transition-all duration-1000",
				"max-h-2 opacity-100",
			)}>
			<Repeat2 className="size-3" strokeWidth={1.5} />
			<span>{retryTimer}s</span>
		</p>
	)

	return (
		<ErrorRow
			type="api_req_retry_delayed"
			code={code}
			message={body}
			docsURL={docsURL}
			additionalContent={retryInfo}
			errorDetails={rawError}
		/>
	)
}

interface ApiReqRateLimitWaitProps {
	message: Notification
	t: (key: string, options?: Record<string, unknown>) => string
}

/** Renders api_req_rate_limit_wait say messages */
export const ApiReqRateLimitWaitSay: React.FC<ApiReqRateLimitWaitProps> = ({ message, t }) => {
	const isWaiting = message.partial === true
	const waitSeconds = React.useMemo(() => {
		if (!message.text) return undefined
		try {
			const data = JSON.parse(message.text)
			return typeof data.seconds === "number" ? data.seconds : undefined
		} catch {
			return undefined
		}
	}, [message.text])

	if (!isWaiting || waitSeconds === undefined) return null

	return (
		<Container
			$preset="header-cost"
			$theme="default"
			$p="0"
			style={{ ...headerStyle, marginBottom: 0 }}
			className="group text-sm transition-opacity opacity-100">
			<ProgressIndicator />
			<span style={{ color: "var(--vscode-foreground)" }}>{t("chat:apiRequest.rateLimitWait")}</span>
			<span className="text-xs font-light text-vscode-descriptionForeground">{waitSeconds}s</span>
		</Container>
	)
}
