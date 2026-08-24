import i18next from "i18next"

export const formatDate = (timestamp: number) => {
	const date = new Date(timestamp)
	const locale = i18next.language || "en"

	return date.toLocaleString(locale, {
		month: "long",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	})
}

function formatTimeUnit(count: number, singularKey: string, pluralKey: string): string {
	if (count <= 0) return ""
	return count === 1 ? i18next.t(singularKey) : i18next.t(pluralKey, { count })
}

export const formatTimeAgo = (timestamp: number) => {
	const now = Date.now()
	const diff = now - timestamp
	const seconds = Math.floor(diff / 1000)
	const minutes = Math.floor(seconds / 60)
	const hours = Math.floor(minutes / 60)
	const days = Math.floor(hours / 24)
	const weeks = Math.floor(days / 7)
	const months = Math.floor(days / 30)
	const years = Math.floor(days / 365)

	if (years > 0) {
		return formatTimeUnit(years, "common:time_ago.year_ago", "common:time_ago.years_ago")
	}
	if (months > 0) {
		return formatTimeUnit(months, "common:time_ago.month_ago", "common:time_ago.months_ago")
	}
	if (weeks > 0) {
		return formatTimeUnit(weeks, "common:time_ago.week_ago", "common:time_ago.weeks_ago")
	}
	if (days > 0) {
		return formatTimeUnit(days, "common:time_ago.day_ago", "common:time_ago.days_ago")
	}
	if (hours > 0) {
		return formatTimeUnit(hours, "common:time_ago.hour_ago", "common:time_ago.hours_ago")
	}
	if (minutes > 0) {
		return formatTimeUnit(minutes, "common:time_ago.minute_ago", "common:time_ago.minutes_ago")
	}
	if (seconds > 30) {
		return i18next.t("common:time_ago.seconds_ago", { count: seconds })
	}

	return i18next.t("common:time_ago.just_now")
}
