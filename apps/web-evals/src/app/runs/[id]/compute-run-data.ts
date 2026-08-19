import type { TaskMetrics, TaskWithMetrics, ToolUsage } from "./components/run-helpers"
import { calculateDurationFromTimestamps } from "./components/run-helpers"

function resolveToolUsage(task: TaskWithMetrics, toolUsage: Map<number, ToolUsage | undefined>): ToolUsage | undefined {
	const dbToolUsage = task.taskMetrics?.toolUsage
	const streamingToolUsage = toolUsage.get(task.id)
	return task.finishedAt
		? dbToolUsage && Object.keys(dbToolUsage).length > 0
			? (dbToolUsage as unknown as ToolUsage)
			: streamingToolUsage
		: streamingToolUsage
}

function computeFinishedTaskMetrics(
	task: TaskWithMetrics,
	dbMetrics: NonNullable<TaskWithMetrics["taskMetrics"]>,
	streamingUsage:
		| { totalTokensIn: number; totalTokensOut: number; contextTokens: number; duration?: number; totalCost: number }
		| undefined,
): TaskMetrics {
	const dbHasData = dbMetrics && (dbMetrics.tokensIn > 0 || dbMetrics.tokensOut > 0 || dbMetrics.cost > 0)
	if (dbHasData) {
		const duration = dbMetrics.duration || calculateDurationFromTimestamps(task)
		return { ...dbMetrics, duration }
	}
	if (streamingUsage) {
		const duration = streamingUsage.duration || calculateDurationFromTimestamps(task)
		return {
			tokensIn: streamingUsage.totalTokensIn,
			tokensOut: streamingUsage.totalTokensOut,
			tokensContext: streamingUsage.contextTokens,
			duration,
			cost: streamingUsage.totalCost,
		}
	}
	return {
		tokensIn: 0,
		tokensOut: 0,
		tokensContext: 0,
		duration: calculateDurationFromTimestamps(task),
		cost: 0,
	}
}

function computeUnfinishedMetrics(
	task: TaskWithMetrics,
	streamingUsage:
		| { totalTokensIn: number; totalTokensOut: number; contextTokens: number; duration?: number; totalCost: number }
		| undefined,
): TaskMetrics | null {
	if (streamingUsage) {
		const duration = streamingUsage.duration || calculateDurationFromTimestamps(task)
		return {
			tokensIn: streamingUsage.totalTokensIn,
			tokensOut: streamingUsage.totalTokensOut,
			tokensContext: streamingUsage.contextTokens,
			duration,
			cost: streamingUsage.totalCost,
		}
	}
	if (task.startedAt) {
		return {
			tokensIn: 0,
			tokensOut: 0,
			tokensContext: 0,
			duration: calculateDurationFromTimestamps(task),
			cost: 0,
		}
	}
	return null
}

export function computeTaskMetrics(
	tasks: TaskWithMetrics[] | undefined,
	tokenUsage: Map<
		number,
		| { totalTokensIn: number; totalTokensOut: number; contextTokens: number; duration?: number; totalCost: number }
		| undefined
	>,
): Record<number, TaskMetrics> {
	const metrics: Record<number, TaskMetrics> = {}

	tasks?.forEach((task) => {
		const streamingUsage = tokenUsage.get(task.id)
		const dbMetrics = task.taskMetrics

		if (task.finishedAt && dbMetrics) {
			metrics[task.id] = computeFinishedTaskMetrics(task, dbMetrics, streamingUsage)
		} else {
			const result = computeUnfinishedMetrics(task, streamingUsage)
			if (result) {
				metrics[task.id] = result
			}
		}
	})

	return metrics
}

export function computeAggregateToolUsage(
	tasks: TaskWithMetrics[],
	toolUsage: Map<number, ToolUsage | undefined>,
	taskMetricsCache: Record<number, TaskMetrics>,
): { totalTokensIn: number; totalTokensOut: number; totalCost: number; totalDuration: number; toolUsage: ToolUsage } {
	let totalTokensIn = 0
	let totalTokensOut = 0
	let totalCost = 0
	let totalDuration = 0
	const toolUsageAggregate: ToolUsage = {}

	for (const task of tasks) {
		const metrics = taskMetricsCache[task.id]
		if (metrics) {
			totalTokensIn += metrics.tokensIn
			totalTokensOut += metrics.tokensOut
			totalCost += metrics.cost
			totalDuration += metrics.duration
		}

		const taskToolUsage = resolveToolUsage(task, toolUsage)

		if (taskToolUsage) {
			for (const [key, usage] of Object.entries(taskToolUsage)) {
				const tool = key as keyof ToolUsage
				if (!toolUsageAggregate[tool]) {
					toolUsageAggregate[tool] = { attempts: 0, failures: 0 }
				}
				toolUsageAggregate[tool].attempts += usage.attempts
				toolUsageAggregate[tool].failures += usage.failures
			}
		}
	}

	return { totalTokensIn, totalTokensOut, totalCost, totalDuration, toolUsage: toolUsageAggregate }
}
