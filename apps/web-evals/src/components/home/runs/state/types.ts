import type { LucideIcon } from "lucide-react"

import type { Run, TaskMetrics } from "@jabberwock/evals"

export type ToolGroup = {
	id: string
	name: string
	icon: string
	tools: string[]
}

export type RunWithTaskMetrics = Run & { taskMetrics: TaskMetrics | null }

export type SortColumn = "model" | "provider" | "passed" | "failed" | "percent" | "cost" | "duration" | "createdAt"

export type SortDirection = "asc" | "desc"

export type TimeframeOption = "all" | "24h" | "7d" | "30d" | "90d"

export type ToolGroupIcon = {
	name: string
	icon: LucideIcon
}
