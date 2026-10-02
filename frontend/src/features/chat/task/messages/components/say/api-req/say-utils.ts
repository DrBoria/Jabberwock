import { safeJsonParse } from "@jabberwock/core/browser"
import type { ApiReqData } from "@jabberwock/types"

export function parseApiReqData(text: string | null | undefined) {
	if (text == null) return {}
	const info = safeJsonParse<ApiReqData>(text)
	return { cost: info?.cost, cancelReason: info?.cancelReason, streamingFailedMessage: info?.streamingFailedMessage }
}

export function getApiRequestFailedMessage(isLast: boolean, lastModifiedMessage?: { ask?: string; text?: string }) {
	return isLast && lastModifiedMessage?.ask === "api_req_failed" ? lastModifiedMessage?.text : undefined
}

export function getPowerShellDocsUrl(message?: string) {
	return message?.toLowerCase().includes("powershell")
		? "https://github.com/cline/cline/wiki/TroubleShooting-%E2%80%90-%22PowerShell-is-not-recognized-as-an-internal-or-external-command%22"
		: undefined
}

export function parseStatusCode(
	text: string,
	i18n: { exists: (key: string) => boolean },
	t: (key: string, options?: Record<string, unknown>) => string,
): { body: string; code?: number; docsURL?: string } {
	const potentialCode = parseInt(text.substring(0, 3))
	if (isNaN(potentialCode) || potentialCode < 400) {
		return { body: t("chat:apiRequest.failed") }
	}

	const code = potentialCode
	const stringForError = `chat:apiRequest.errorMessage.${code}`
	if (i18n.exists(stringForError)) {
		return { body: t(stringForError), code }
	}

	return {
		body: t("chat:apiRequest.errorMessage.unknown"),
		code,
		docsURL: "mailto:support@jabberwock.com?subject=Unknown API Error&body=[Please include full error details]",
	}
}

export function parseRetryTimer(text: string): { rawError: string; retryTimer: number } {
	const retryTimerMatch = text.match(/<retry_timer>(.*?)<\/retry_timer>/)
	const retryTimer = retryTimerMatch?.[1] ? parseInt(retryTimerMatch[1], 10) : 0
	const rawError = text.replace(/<retry_timer>(.*?)<\/retry_timer>/, "").trim()
	return { rawError, retryTimer }
}
