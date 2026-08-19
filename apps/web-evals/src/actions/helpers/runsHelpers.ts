import fs from "fs"
import { spawn } from "child_process"

import pMap from "p-map"

import { type ExerciseLanguage, exerciseLanguages, createTask, getExercisesForLanguage } from "@jabberwock/evals"

import type { CreateRun } from "@/lib/schemas"
import { redisClient } from "@/lib/server/redis"

const EVALS_STORAGE_PATH = "/tmp/evals/runs"

export async function createRunTasks(
	runId: number,
	suite: CreateRun["suite"],
	exercises: string[],
	iterations: number,
	values: Partial<CreateRun>,
	evalsRepoPath: string,
) {
	if (suite === "partial") {
		await createPartialSuiteTasks(runId, exercises, iterations, values)
	} else {
		await createFullSuiteTasks(runId, iterations, values, evalsRepoPath)
	}
}

async function createPartialSuiteTasks(
	runId: number,
	exercises: string[],
	iterations: number,
	values: Partial<CreateRun>,
) {
	for (const exercisePath of exercises) {
		const [language, exercise] = exercisePath.split("/")

		if (!language || !exercise) {
			throw new Error("Invalid exercise path: " + exercisePath)
		}

		for (let iteration = 1; iteration <= iterations; iteration++) {
			await createTask({
				...values,
				runId,
				language: language as ExerciseLanguage,
				exercise,
				iteration,
			})
		}
	}
}

async function createFullSuiteTasks(
	runId: number,
	iterations: number,
	values: Partial<CreateRun>,
	evalsRepoPath: string,
) {
	for (const language of exerciseLanguages) {
		const languageExercises = await getExercisesForLanguage(evalsRepoPath, language)

		const tasksToCreate: Array<{ language: ExerciseLanguage; exercise: string; iteration: number }> = []
		for (const exercise of languageExercises) {
			for (let iteration = 1; iteration <= iterations; iteration++) {
				tasksToCreate.push({ language, exercise, iteration })
			}
		}

		await pMap(
			tasksToCreate,
			({ language, exercise, iteration }) => createTask({ runId, language, exercise, iteration }),
			{ concurrency: 10 },
		)
	}
}

export function spawnRunProcess(runId: number) {
	const isRunningInDocker = fs.existsSync("/.dockerenv")

	const dockerArgs = [
		`--name evals-controller-${runId}`,
		"--rm",
		"--network evals_default",
		"-v /var/run/docker.sock:/var/run/docker.sock",
		"-v /tmp/evals:/var/log/evals",
		"-e HOST_EXECUTION_METHOD=docker",
	]

	const cliCommand = `pnpm --filter @jabberwock/evals cli --runId ${runId}`

	const command = isRunningInDocker
		? `docker run ${dockerArgs.join(" ")} evals-runner sh -c "${cliCommand}"`
		: cliCommand

	console.log("spawn ->", command)

	const childProcess = spawn("sh", ["-c", command], {
		detached: true,
		stdio: ["ignore", "pipe", "pipe"],
	})

	const logStream = fs.createWriteStream("/tmp/jabberwock-evals.log", { flags: "a" })

	if (childProcess.stdout) {
		childProcess.stdout.pipe(logStream)
	}

	if (childProcess.stderr) {
		childProcess.stderr.pipe(logStream)
	}

	childProcess.unref()
}

export async function deleteRunStorageFolders(runIds: number[], storageErrors: string[]) {
	for (const runId of runIds) {
		const storagePath = `${EVALS_STORAGE_PATH}/${runId}`
		try {
			if (fs.existsSync(storagePath)) {
				fs.rmSync(storagePath, { recursive: true, force: true })
				console.log(`Deleted storage folder: ${storagePath}`)
			}
		} catch (error) {
			console.error(`Failed to delete storage folder ${storagePath}:`, error)
			storageErrors.push(`Failed to delete storage for run ${runId}`)
		}
	}
}

export async function clearRunRedisState(runId: number) {
	try {
		const redis = await redisClient()
		await redis.del(`heartbeat:${runId}`)
		await redis.del(`runners:${runId}`)
	} catch (error) {
		console.error(`Failed to clear Redis state for run ${runId}:`, error)
	}
}
