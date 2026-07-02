import type { ToolUsage } from "./run-helpers"

export type Stats = {
	passed: number
	failed: number
	completed: number
	remaining: number
	passRate: string | null
	totalTokensIn: number
	totalTokensOut: number
	totalCost: number
	totalDuration: number
	toolUsage: ToolUsage
}
