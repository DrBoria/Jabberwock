import { type TaskEvent, JabberwockEventName } from "@jabberwock/types"

import { findRun, findTask, updateTask } from "../db/index"

import { Logger } from "./helpers/logging/logger"
import { getTag, isDockerContainer } from "./utils"
import { redisClient, getPubSubKey, registerRunner, deregisterRunner } from "./redis"
import { runUnitTest } from "./runners/runUnitTest"
import { runTaskWithCli } from "./runners/runTaskInCli"
import { runTaskInVscode } from "./runners/runTaskInVscode"

import { buildContainerDockerArgs, runContainerAttempt } from "./helpers/processTaskHelpers"

export const processTask = async ({
	taskId,
	jobToken,
	logger,
}: {
	taskId: number
	jobToken: string | null
	logger?: Logger
}) => {
	const task = await findTask(taskId)
	const { language, exercise } = task
	const run = await findRun(task.runId)
	await registerRunner({ runId: run.id, taskId, timeoutSeconds: (run.timeout || 5) * 60 })

	const containerized = isDockerContainer()

	logger =
		logger ||
		new Logger({
			logDir: containerized ? `/var/log/evals/runs/${run.id}` : `/tmp/evals/runs/${run.id}`,
			filename: `${language}-${exercise}.log`,
			tag: getTag("runTask", { run, task }),
		})

	try {
		const publish = async (e: TaskEvent) => {
			const redis = await redisClient()
			await redis.publish(getPubSubKey(run.id), JSON.stringify(e))
		}

		const executionMethod = run.executionMethod || "vscode"
		logger.info(`running task ${task.id} (${language}/${exercise}) via ${executionMethod}...`)

		if (executionMethod === "cli") {
			await runTaskWithCli({ run, task, jobToken, publish, logger })
		} else {
			await runTaskInVscode({ run, task, jobToken, publish, logger })
		}

		logger.info(`testing task ${task.id} (${language}/${exercise})...`)
		const passed = await runUnitTest({ task, logger })

		logger.info(`task ${task.id} (${language}/${exercise}) -> ${passed}`)
		await updateTask(task.id, { passed })

		await publish({
			eventName: passed ? JabberwockEventName.EvalPass : JabberwockEventName.EvalFail,
			taskId: task.id,
		})
	} finally {
		await deregisterRunner({ runId: run.id, taskId })
	}
}

export const processTaskInContainer = async ({
	taskId,
	jobToken,
	logger,
	maxRetries = 10,
}: {
	taskId: number
	jobToken: string | null
	logger: Logger
	maxRetries?: number
}) => {
	const baseArgs = buildContainerDockerArgs(taskId, jobToken)

	const command = `pnpm --filter @jabberwock/evals cli --taskId ${taskId}`
	logger.info(command)

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		const containerName = `evals-task-${taskId}.${attempt}`
		const args = [`--name ${containerName}`, ...baseArgs]

		if (attempt > 0) {
			const delayMs = Math.pow(2, attempt - 1) * 1000 * (0.5 + Math.random())
			logger.info(`retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries + 1})`)
			await new Promise((resolve) => setTimeout(resolve, delayMs))
		}

		logger.info(`executing container command (attempt ${attempt + 1}/${maxRetries + 1})`)

		const success = await runContainerAttempt({ args, command, logger })

		if (success) {
			return
		}
	}

	logger.error(`all ${maxRetries + 1} attempts failed, giving up`)
}
