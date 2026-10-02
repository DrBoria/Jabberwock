import { asc, eq, sql } from "drizzle-orm"

import type { ExerciseLanguage } from "../../../exercises/catalog"

import { createCrudStore } from "../crud"
import { tasks } from "../../schema"
import { client as db } from "../../client"

export const tasksStore = createCrudStore(tasks)

export const getTasks = async (runId: number) => {
	const where = eq(tasks.runId, runId)

	return db.query.tasks.findMany({
		where,
		with: { taskMetrics: true },
		orderBy: asc(tasks.id),
	})
}

export const getLanguageScores = async () => {
	const records = await db
		.select({
			runId: tasks.runId,
			language: tasks.language,
			score: sql<number>`cast(sum(case when ${tasks.passed} = true then 1 else 0 end) as float) / count(*)`,
		})
		.from(tasks)
		.groupBy(tasks.runId, tasks.language)

	const results: Record<number, Record<ExerciseLanguage, number>> = {}

	for (const { runId, language, score } of records) {
		if (!results[runId]) {
			results[runId] = { go: 0, java: 0, javascript: 0, python: 0, rust: 0 }
		}

		results[runId][language] = score
	}

	return results
}
