import { eq } from "drizzle-orm"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"

import type { ToolUsage } from "@jabberwock/types"
import type { InsertRun, InsertTask, InsertTaskMetrics, InsertToolError } from "../../schema"
import { schema } from "../../schema"

import { RecordNotFoundError, RecordNotCreatedError } from "../errors-main"

async function copyTaskMetrics(
	sourceDb: NodePgDatabase<typeof schema>,
	targetDb: NodePgDatabase<typeof schema>,
	sourceMetrics:
		| {
				tokensIn: number
				tokensOut: number
				tokensContext: number
				cacheWrites: number
				cacheReads: number
				cost: number
				duration: number
				toolUsage: ToolUsage | null | undefined
		  }
		| null
		| undefined,
): Promise<number | null> {
	if (!sourceMetrics) {
		return null
	}

	const metricsData: InsertTaskMetrics = {
		tokensIn: sourceMetrics.tokensIn,
		tokensOut: sourceMetrics.tokensOut,
		tokensContext: sourceMetrics.tokensContext,
		cacheWrites: sourceMetrics.cacheWrites,
		cacheReads: sourceMetrics.cacheReads,
		cost: sourceMetrics.cost,
		duration: sourceMetrics.duration,
		toolUsage: sourceMetrics.toolUsage,
	}

	const result = await targetDb
		.insert(schema.taskMetrics)
		.values({ ...metricsData, createdAt: new Date() })
		.returning()

	const created = result[0]

	if (!created) {
		throw new RecordNotCreatedError("Failed to create taskMetrics")
	}

	return created.id
}

async function copyRunToolErrors({
	sourceDb,
	targetDb,
	oldRunId,
	newRunId,
	taskIdMapping,
}: {
	sourceDb: NodePgDatabase<typeof schema>
	targetDb: NodePgDatabase<typeof schema>
	oldRunId: number
	newRunId: number
	taskIdMapping: Map<number, number>
}): Promise<void> {
	const sourceRunToolErrors = await sourceDb.query.toolErrors.findMany({
		where: eq(schema.toolErrors.runId, oldRunId),
	})

	for (const sourceToolError of sourceRunToolErrors) {
		if (sourceToolError.taskId && taskIdMapping.has(sourceToolError.taskId)) {
			continue
		}

		const toolErrorData: InsertToolError = {
			runId: newRunId,
			taskId: sourceToolError.taskId ? taskIdMapping.get(sourceToolError.taskId) || null : null,
			toolName: sourceToolError.toolName,
			error: sourceToolError.error,
		}

		await targetDb.insert(schema.toolErrors).values({ ...toolErrorData, createdAt: new Date() })
	}
}

async function copyTaskToolErrors({
	sourceDb,
	targetDb,
	newRunId,
	taskIdMapping,
}: {
	sourceDb: NodePgDatabase<typeof schema>
	targetDb: NodePgDatabase<typeof schema>
	newRunId: number
	taskIdMapping: Map<number, number>
}): Promise<void> {
	for (const [oldTaskId, newTaskId] of taskIdMapping) {
		const sourceTaskToolErrors = await sourceDb.query.toolErrors.findMany({
			where: eq(schema.toolErrors.taskId, oldTaskId),
		})

		for (const sourceToolError of sourceTaskToolErrors) {
			const toolErrorData: InsertToolError = {
				runId: newRunId,
				taskId: newTaskId,
				toolName: sourceToolError.toolName,
				error: sourceToolError.error,
			}

			await targetDb.insert(schema.toolErrors).values({ ...toolErrorData, createdAt: new Date() })
		}
	}
}

export const copyRun = async ({
	sourceDb,
	targetDb,
	runId,
}: {
	sourceDb: NodePgDatabase<typeof schema>
	targetDb: NodePgDatabase<typeof schema>
	runId: number
}) => {
	const sourceRun = await sourceDb.query.runs.findFirst({
		where: eq(schema.runs.id, runId),
		with: { taskMetrics: true },
	})

	if (!sourceRun) {
		throw new RecordNotFoundError(`Run with ID ${runId} not found`)
	}

	const newTaskMetricsId = await copyTaskMetrics(sourceDb, targetDb, sourceRun.taskMetrics)

	const runData: InsertRun = {
		taskMetricsId: newTaskMetricsId,
		model: sourceRun.model,
		description: sourceRun.description,
		settings: sourceRun.settings,
		pid: sourceRun.pid,
		socketPath: sourceRun.socketPath,
		concurrency: sourceRun.concurrency,
		passed: sourceRun.passed,
		failed: sourceRun.failed,
	}

	const newRuns = await targetDb
		.insert(schema.runs)
		.values({ ...runData, createdAt: new Date() })
		.returning()

	const newRun = newRuns[0]

	if (!newRun) {
		throw new RecordNotCreatedError("Failed to create run")
	}

	const newRunId = newRun.id

	const sourceTasks = await sourceDb.query.tasks.findMany({
		where: eq(schema.tasks.runId, runId),
		with: { taskMetrics: true },
	})

	const taskIdMapping = new Map<number, number>()

	for (const sourceTask of sourceTasks) {
		const newTaskMetricsId = await copyTaskMetrics(sourceDb, targetDb, sourceTask.taskMetrics)

		const taskData: InsertTask = {
			runId: newRunId,
			taskMetricsId: newTaskMetricsId,
			language: sourceTask.language,
			exercise: sourceTask.exercise,
			passed: sourceTask.passed,
			startedAt: sourceTask.startedAt,
			finishedAt: sourceTask.finishedAt,
		}

		const newTasks = await targetDb
			.insert(schema.tasks)
			.values({ ...taskData, createdAt: new Date() })
			.returning()

		const newTask = newTasks[0]

		if (!newTask) {
			throw new RecordNotCreatedError("Failed to create task")
		}

		taskIdMapping.set(sourceTask.id, newTask.id)
	}

	await copyTaskToolErrors({ sourceDb, targetDb, newRunId, taskIdMapping })
	await copyRunToolErrors({ sourceDb, targetDb, oldRunId: runId, newRunId, taskIdMapping })

	return newRunId
}
