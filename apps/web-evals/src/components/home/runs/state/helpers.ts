import type { LucideIcon } from "lucide-react"

import { TOOL_GROUP_ICONS } from "./constants"
import type { SortColumn, TimeframeOption } from "./types"

export function getIconByName(name: string): LucideIcon {
	return (TOOL_GROUP_ICONS.find((i) => i.name === name) ?? TOOL_GROUP_ICONS[0]!).icon
}

export function generateGroupId(): string {
	return `group-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

export function getTimeframeStartDate(timeframe: TimeframeOption): Date | null {
	if (timeframe === "all") return null
	const now = new Date()
	switch (timeframe) {
		case "24h":
			return new Date(now.getTime() - 24 * 60 * 60 * 1000)
		case "7d":
			return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
		case "30d":
			return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
		case "90d":
			return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
		default:
			return null
	}
}

export function getToolAbbreviation(toolName: string): string {
	const parts = toolName.split("_")
	const abbreviation = parts.map((word) => word[0]?.toUpperCase() ?? "").join("")
	return abbreviation
}

export function filterRunByTimeframe(run: { createdAt: Date }, timeframeFilter: TimeframeOption): boolean {
	const timeframeStart = getTimeframeStartDate(timeframeFilter)
	return !(timeframeStart && run.createdAt < timeframeStart)
}

export function filterRunByModel(run: { model: string }, modelFilter: string[]): boolean {
	return modelFilter.length === 0 || modelFilter.includes(run.model)
}

export function filterRunByProvider(
	run: { settings?: { apiProvider?: string } | null },
	providerFilter: string[],
): boolean {
	if (providerFilter.length === 0) return true
	const provider = run.settings?.apiProvider
	return !!provider && providerFilter.includes(provider)
}

type RunSortable = {
	model: string
	passed: number
	failed: number
	createdAt: Date
	settings?: { apiProvider?: string } | null
	taskMetrics?: { cost?: number; duration?: number } | null
}

function getSortValueForProvider(run: RunSortable): string {
	return run.settings?.apiProvider ?? ""
}

function getSortValueForPercent(run: RunSortable): number {
	const total = run.passed + run.failed
	return total > 0 ? run.passed / total : 0
}

function getSortValueForCost(run: RunSortable): number {
	return run.taskMetrics?.cost ?? 0
}

function getSortValueForDuration(run: RunSortable): number {
	return run.taskMetrics?.duration ?? 0
}

export function getSortValue(run: RunSortable, sortColumn: SortColumn): string | number | Date | null {
	switch (sortColumn) {
		case "model":
			return run.model
		case "provider":
			return getSortValueForProvider(run)
		case "passed":
			return run.passed
		case "failed":
			return run.failed
		case "percent":
			return getSortValueForPercent(run)
		case "cost":
			return getSortValueForCost(run)
		case "duration":
			return getSortValueForDuration(run)
		case "createdAt":
			return run.createdAt
	}
}

export function compareSortValues(
	aVal: string | number | Date | null,
	bVal: string | number | Date | null,
	sortDirection: "asc" | "desc",
): number {
	if (aVal === null || bVal === null) return 0

	let comparison = 0
	if (typeof aVal === "string" && typeof bVal === "string") {
		comparison = aVal.localeCompare(bVal)
	} else if (aVal instanceof Date && bVal instanceof Date) {
		comparison = aVal.getTime() - bVal.getTime()
	} else {
		comparison = (aVal as number) - (bVal as number)
	}

	return sortDirection === "asc" ? comparison : -comparison
}
