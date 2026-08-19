"use server"

import * as path from "path"
import { fileURLToPath } from "url"
import { execFileSync } from "child_process"

import { revalidatePath } from "next/cache"

import {
	deleteRun as _deleteRun,
	updateRun as _updateRun,
	getIncompleteRuns as _getIncompleteRuns,
	deleteRunsByIds as _deleteRunsByIds,
	createRun as _createRun,
	getRuns,
} from "@jabberwock/evals"

import type { CreateRun } from "@/lib/schemas"
import {
	createRunTasks,
	spawnRunProcess,
	deleteRunStorageFolders,
	clearRunRedisState,
} from "@/actions/helpers/runsHelpers"

const EVALS_REPO_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../../evals")

export async function createRun({
	suite,
	exercises = [],
	timeout,
	iterations = 1,
	executionMethod = "vscode",
	...values
}: CreateRun) {
	const run = await _createRun({
		...values,
		timeout,
		executionMethod,
		socketPath: "",
	})

	await createRunTasks(run.id, suite, exercises, iterations, values, EVALS_REPO_PATH)

	revalidatePath("/runs")

	try {
		spawnRunProcess(run.id)
	} catch (error) {
		console.error(error)
	}

	return run
}

export async function deleteRun(runId: number) {
	await _deleteRun(runId)
	revalidatePath("/runs")
}

export type KillRunResult = {
	success: boolean
	killedContainers: string[]
	errors: string[]
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function killRun(runId: number): Promise<KillRunResult> {
	const killedContainers: string[] = []
	const errors: string[] = []
	const controllerPattern = `evals-controller-${runId}`
	const taskPattern = `evals-task-${runId}-`

	try {
		killController(controllerPattern, killedContainers)

		console.log("Waiting 10 seconds before killing runners...")
		await sleep(10000)

		const taskContainerNames = findTaskContainers(taskPattern, errors)
		killTaskContainers(taskContainerNames, killedContainers, errors)

		await clearRunRedisState(runId)
	} catch (error) {
		console.error("Error in killRun:", error)
		errors.push("Unexpected error while killing containers")
	}

	revalidatePath(`/runs/${runId}`)
	revalidatePath("/runs")

	return {
		success: killedContainers.length > 0 || errors.length === 0,
		killedContainers,
		errors,
	}
}

function killController(controllerPattern: string, killedContainers: string[]) {
	try {
		execFileSync("docker", ["kill", controllerPattern], { encoding: "utf-8", timeout: 10000 })
		killedContainers.push(controllerPattern)
		console.log(`Killed controller container: ${controllerPattern}`)
	} catch {
		console.log(`Controller ${controllerPattern} not running or already stopped`)
	}
}

function findTaskContainers(taskPattern: string, errors: string[]): string[] {
	try {
		const output = execFileSync("docker", ["ps", "--format", "{{.Names}}", "--filter", `name=${taskPattern}`], {
			encoding: "utf-8",
			timeout: 10000,
		})
		return output
			.split("\n")
			.map((name) => name.trim())
			.filter((name) => name.length > 0 && name.startsWith(taskPattern))
	} catch (error) {
		console.error("Failed to list task containers:", error)
		errors.push("Failed to list Docker task containers")
		return []
	}
}

function killTaskContainers(containerNames: string[], killedContainers: string[], errors: string[]) {
	for (const containerName of containerNames) {
		try {
			execFileSync("docker", ["kill", containerName], { encoding: "utf-8", timeout: 10000 })
			killedContainers.push(containerName)
			console.log(`Killed task container: ${containerName}`)
		} catch (error) {
			console.error(`Failed to kill container ${containerName}:`, error)
			errors.push(`Failed to kill container: ${containerName}`)
		}
	}
}

export type DeleteIncompleteRunsResult = {
	success: boolean
	deletedCount: number
	deletedRunIds: number[]
	storageErrors: string[]
}

export async function deleteIncompleteRuns(): Promise<DeleteIncompleteRunsResult> {
	const storageErrors: string[] = []

	const incompleteRuns = await _getIncompleteRuns()
	const runIds = incompleteRuns.map((run) => run.id)

	if (runIds.length === 0) {
		return {
			success: true,
			deletedCount: 0,
			deletedRunIds: [],
			storageErrors: [],
		}
	}

	await deleteRunStorageFolders(runIds, storageErrors)

	for (const runId of runIds) {
		await clearRunRedisState(runId)
	}

	await _deleteRunsByIds(runIds)

	revalidatePath("/runs")

	return {
		success: true,
		deletedCount: runIds.length,
		deletedRunIds: runIds,
		storageErrors,
	}
}

export async function getIncompleteRunsCount(): Promise<number> {
	const incompleteRuns = await _getIncompleteRuns()
	return incompleteRuns.length
}

export async function deleteOldRuns(): Promise<DeleteIncompleteRunsResult> {
	const storageErrors: string[] = []

	const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
	const allRuns = await getRuns()
	const oldRuns = allRuns.filter((run) => run.createdAt < thirtyDaysAgo)
	const runIds = oldRuns.map((run) => run.id)

	if (runIds.length === 0) {
		return {
			success: true,
			deletedCount: 0,
			deletedRunIds: [],
			storageErrors: [],
		}
	}

	await deleteRunStorageFolders(runIds, storageErrors)

	for (const runId of runIds) {
		await clearRunRedisState(runId)
	}

	await _deleteRunsByIds(runIds)

	revalidatePath("/runs")

	return {
		success: true,
		deletedCount: runIds.length,
		deletedRunIds: runIds,
		storageErrors,
	}
}

export async function updateRunDescription(runId: number, description: string | null): Promise<{ success: boolean }> {
	try {
		await _updateRun(runId, { description })
		revalidatePath("/runs")
		revalidatePath(`/runs/${runId}`)
		return { success: true }
	} catch (error) {
		console.error("Failed to update run description:", error)
		return { success: false }
	}
}
