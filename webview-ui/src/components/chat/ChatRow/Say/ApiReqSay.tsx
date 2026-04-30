import React from "react"
import { Repeat2 } from "lucide-react"
import type { ClineMessage, ClineApiReqInfo } from "@jabberwock/types"
import { safeJsonParse } from "@shared/core"
import { cn } from "@/lib/utils"
import { ErrorRow } from "../../ErrorRow"
import { ProgressIndicator } from "../../ProgressIndicator"
import { headerStyle, Container } from "@src/components/ui"

interface ApiReqStartedProps {
	message: ClineMessage
	isLast: boolean
	lastModifiedMessage?: ClineMessage
	icon: React.ReactNode
	title: React.ReactNode
	t: any
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
	const [cost, apiReqCancelReason, apiReqStreamingFailedMessage] = React.useMemo(() => {
		if (message.text !== null && message.text !== undefined) {
			const info = safeJsonParse<ClineApiReqInfo>(message.text)
			return [info?.cost, info?.cancelReason, info?.streamingFailedMessage]
		}
		return [undefined, undefined, undefined]
	}, [message.text])

	const apiRequestFailedMessage =
		isLast && lastModifiedMessage?.ask === "api_req_failed" ? lastModifiedMessage?.text : undefined

	const isApiRequestInProgress =
		apiReqCancelReason === undefined && apiRequestFailedMessage === undefined && cost === undefined

	return (
		<>
			<Container
				preset="header-cost"
				theme="default"
				p="0"
				style={{
					...headerStyle,
					marginBottom:
						((cost === null || cost === undefined) && apiRequestFailedMessage) ||
						apiReqStreamingFailedMessage
							? 10
							: 0,
					opacity: isApiRequestInProgress ? 1 : 0.4,
				}}
				className="group text-sm transition-opacity hover:opacity-100">
				{icon}
				{title}
				<div
					className="text-xs text-vscode-dropdown-foreground border-vscode-dropdown-border/50 border px-1.5 py-0.5 rounded-lg"
					style={{ opacity: cost !== null && cost !== undefined && cost > 0 ? 1 : 0 }}>
					${Number(cost || 0)?.toFixed(4)}
				</div>
			</Container>
			{(((cost === null || cost === undefined) && apiRequestFailedMessage) || apiReqStreamingFailedMessage) && (
				<ErrorRow
					type="api_failure"
					message={apiRequestFailedMessage || apiReqStreamingFailedMessage || ""}
					docsURL={
						apiRequestFailedMessage?.toLowerCase().includes("powershell")
							? "https://github.com/cline/cline/wiki/TroubleShooting-%E2%80%90-%22PowerShell-is-not-recognized-as-an-internal-or-external-command%22"
							: undefined
					}
					errorDetails={apiReqStreamingFailedMessage}
				/>
			)}
		</>
	)
}

interface ApiReqRetryDelayedProps {
	message: ClineMessage
	t: any
	i18n: any
}

/** Renders api_req_retry_delayed say messages */
export const ApiReqRetryDelayedSay: React.FC<ApiReqRetryDelayedProps> = ({ message, t, i18n }) => {
	let body = t("chat:apiRequest.failed")
	let retryInfo, rawError, code, docsURL
	if (message.text !== undefined) {
		const potentialCode = parseInt(message.text.substring(0, 3))
		if (!isNaN(potentialCode) && potentialCode >= 400) {
			code = potentialCode
			const stringForError = `chat:apiRequest.errorMessage.${code}`
			if (i18n.exists(stringForError)) {
				body = t(stringForError)
			} else {
				body = t("chat:apiRequest.errorMessage.unknown")
				docsURL =
					"mailto:support@jabberwock.com?subject=Unknown API Error&body=[Please include full error details]"
			}
		}
		const retryTimerMatch = message.text.match(/<retry_timer>(.*?)<\/retry_timer>/)
		const retryTimer = retryTimerMatch && retryTimerMatch[1] ? parseInt(retryTimerMatch[1], 10) : 0
		rawError = message.text.replace(/<retry_timer>(.*?)<\/retry_timer>/, "").trim()
		retryInfo = retryTimer > 0 && (
			<p
				className={cn(
					"mt-2 font-light text-xs text-vscode-descriptionForeground cursor-default flex items-center gap-1 transition-all duration-1000",
					retryTimer === 0 ? "opacity-0 max-h-0" : "max-h-2 opacity-100",
				)}>
				<Repeat2 className="size-3" strokeWidth={1.5} />
				<span>{retryTimer}s</span>
			</p>
		)
	}
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
	message: ClineMessage
	t: any
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
			preset="header-cost"
			theme="default"
			p="0"
			style={{ ...headerStyle, marginBottom: 0 }}
			className="group text-sm transition-opacity opacity-100">
			<ProgressIndicator />
			<span style={{ color: "var(--vscode-foreground)" }}>{t("chat:apiRequest.rateLimitWait")}</span>
			<span className="text-xs font-light text-vscode-descriptionForeground">{waitSeconds}s</span>
		</Container>
	)
}
