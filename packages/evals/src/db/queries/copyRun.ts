import { eq } from "drizzle-orm"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"

import type { InsertRun, InsertTask } from "../schema"
import { schema } from "../schema"

import { RecordNotFoundError, RecordNotCreatedError } from "./errors"
import { copyTaskMetrics, copyTaskToolErrors, copyRunToolErrors } from "./helpers/copyRunHelpers"

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
