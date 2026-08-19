import { eq } from "drizzle-orm"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"

import type { ToolUsage } from "@jabberwock/types"
import type { InsertTaskMetrics, InsertToolError } from "../../schema"
import { schema } from "../../schema"

import { RecordNotCreatedError } from "../errors"

export async function copyTaskMetrics(
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

export async function copyRunToolErrors({
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

export async function copyTaskToolErrors({
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
