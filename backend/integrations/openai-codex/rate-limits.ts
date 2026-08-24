import type { OpenAiCodexRateLimitInfo } from "@jabberwock/types"

const WHAM_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage"

type WhamUsageResponse = {
	rate_limit?: {
		primary_window?: {
			limit_window_seconds?: number
			used_percent?: number
			reset_at?: number
		}
		secondary_window?: {
			limit_window_seconds?: number
			used_percent?: number
			reset_at?: number
		}
	}
	plan_type?: string
}

function clampPercent(value: number): number {
	if (!Number.isFinite(value)) return 0
	return Math.max(0, Math.min(100, value))
}

function secondsToMs(value: number | undefined): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? Math.round(value * 1000) : undefined
}

export function parseOpenAiCodexUsagePayload(payload: unknown, fetchedAt: number): OpenAiCodexRateLimitInfo {
	const data = toWhamUsageResponse(payload)
	const primaryRaw = data.rate_limit?.primary_window
	const secondaryRaw = data.rate_limit?.secondary_window

	const primary = buildWindowInfo(primaryRaw)
	const secondary = buildWindowInfo(secondaryRaw)

	return buildRateLimitInfo(primary, secondary, data.plan_type, fetchedAt)
}

function toWhamUsageResponse(payload: unknown): WhamUsageResponse {
	if (payload && typeof payload === "object") {
		return payload as WhamUsageResponse
	}
	return {}
}

function buildWindowInfo(
	raw: WhamUsageResponse["rate_limit"] extends undefined
		? undefined
		: NonNullable<WhamUsageResponse["rate_limit"]>["primary_window"] | undefined,
): OpenAiCodexRateLimitInfo["primary"] | undefined {
	if (!raw || typeof raw.used_percent !== "number") {
		return undefined
	}

	const info: OpenAiCodexRateLimitInfo["primary"] = {
		usedPercent: clampPercent(raw.used_percent),
	}

	if (typeof raw.limit_window_seconds === "number") {
		info.windowMinutes = Math.round(raw.limit_window_seconds / 60)
	}

	const resetsAt = secondsToMs(raw.reset_at)
	if (resetsAt !== undefined) {
		info.resetsAt = resetsAt
	}

	return info
}

function buildRateLimitInfo(
	primary: OpenAiCodexRateLimitInfo["primary"] | undefined,
	secondary: OpenAiCodexRateLimitInfo["secondary"] | undefined,
	planType: string | undefined,
	fetchedAt: number,
): OpenAiCodexRateLimitInfo {
	const result: OpenAiCodexRateLimitInfo = { fetchedAt }

	if (primary) {
		result.primary = primary
	}

	if (secondary) {
		result.secondary = secondary
	}

	if (typeof planType === "string") {
		result.planType = planType
	}

	return result
}

export async function fetchOpenAiCodexRateLimitInfo(
	accessToken: string,
	options?: { accountId?: string | null },
): Promise<OpenAiCodexRateLimitInfo> {
	const fetchedAt = Date.now()
	const headers: Record<string, string> = {
		Authorization: `Bearer ${accessToken}`,
		Accept: "application/json",
	}
	if (options?.accountId) {
		headers["ChatGPT-Account-Id"] = options.accountId
	}

	const response = await fetch(WHAM_USAGE_URL, { method: "GET", headers })
	if (!response.ok) {
		const text = await response.text().catch(() => "")
		throw new Error(
			`OpenAI Codex WHAM usage request failed: ${response.status} ${response.statusText}${text ? ` - ${text}` : ""}`,
		)
	}

	const json: unknown = await response.json()
	const parsed = parseOpenAiCodexUsagePayload(json, fetchedAt)
	if (!parsed.primary && !parsed.secondary) {
		throw new Error("OpenAI Codex WHAM usage response did not include rate_limit windows")
	}
	return parsed
}
