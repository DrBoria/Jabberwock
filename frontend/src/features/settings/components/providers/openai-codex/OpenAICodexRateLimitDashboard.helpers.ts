type Translate = (key: string, options?: Record<string, unknown>) => string

export function formatDurationSeconds(totalSeconds: number, t: Translate): string {
	const days = Math.floor(totalSeconds / 86400)
	const hours = Math.floor((totalSeconds % 86400) / 3600)
	const minutes = Math.floor((totalSeconds % 3600) / 60)

	if (days > 0) {
		return t("settings:providers.openAiCodexRateLimits.duration.daysHours", { days, hours })
	}
	if (hours > 0) {
		return t("settings:providers.openAiCodexRateLimits.duration.hoursMinutes", { hours, minutes })
	}
	return t("settings:providers.openAiCodexRateLimits.duration.minutes", { minutes })
}

export function formatTimeRemainingMs(ms: number | undefined, t: Translate): string {
	if (ms === undefined) return ""
	if (ms <= 0) return t("settings:providers.openAiCodexRateLimits.time.now")
	const totalSeconds = Math.max(0, Math.floor(ms / 1000))
	return formatDurationSeconds(totalSeconds, t)
}

export function formatResetTimeMs(resetMs: number | undefined, t: Translate): string {
	if (!resetMs) return t("settings:providers.openAiCodexRateLimits.time.notAvailable")
	const diffMs = resetMs - Date.now()
	if (diffMs <= 0) return t("settings:providers.openAiCodexRateLimits.time.now")

	const diffSec = Math.floor(diffMs / 1000)
	return formatDurationSeconds(diffSec, t)
}

export function formatWindowLabel(windowMinutes: number | undefined, t: Translate): string | undefined {
	if (!windowMinutes) return undefined
	if (windowMinutes === 60) return t("settings:providers.openAiCodexRateLimits.window.oneHour")
	if (windowMinutes === 24 * 60) return t("settings:providers.openAiCodexRateLimits.window.daily")
	if (windowMinutes === 7 * 24 * 60) return t("settings:providers.openAiCodexRateLimits.window.weekly")
	if (windowMinutes === 5 * 60) return t("settings:providers.openAiCodexRateLimits.window.fiveHour")
	if (windowMinutes % (24 * 60) === 0) {
		return t("settings:providers.openAiCodexRateLimits.window.days", { days: windowMinutes / (24 * 60) })
	}
	if (windowMinutes % 60 === 0) {
		return t("settings:providers.openAiCodexRateLimits.window.hours", { hours: windowMinutes / 60 })
	}
	return t("settings:providers.openAiCodexRateLimits.window.minutes", { minutes: windowMinutes })
}

export function formatPlanLabel(planType: string | undefined, t: Translate): string {
	if (!planType) return t("settings:providers.openAiCodexRateLimits.plan.default")
	return t("settings:providers.openAiCodexRateLimits.plan.withType", { planType })
}

export function getUsageStatusLabel(
	used: number | undefined,
	timeRemaining: string,
	resetAt: number | undefined,
	t: Translate,
): string {
	const usedLabel =
		used !== undefined ? t("settings:providers.openAiCodexRateLimits.usedPercent", { percent: used }) : ""
	const resetLabel = timeRemaining
		? t("settings:providers.openAiCodexRateLimits.resetsIn", { time: timeRemaining })
		: resetAt
			? t("settings:providers.openAiCodexRateLimits.resetsIn", {
					time: formatResetTimeMs(resetAt, t),
				})
			: ""

	if (usedLabel && resetLabel) return `${usedLabel} • ${resetLabel}`
	return usedLabel || resetLabel
}
