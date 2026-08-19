import * as path from "path"
import * as os from "node:os"

import { execa } from "execa"

import { updateTask, createTaskMetrics } from "../../db/index"
import { EVALS_REPO_PATH } from "../../exercises/index"

import { type RunTaskOptions } from "../types"
import { waitForSubprocessWithTimeout } from "../utils"
import { connectToIpc } from "../helpers/connectToIpc"
import { setupStdioLogging } from "../helpers/logging/stdioLogging"
import { registerCliTaskEventHandler } from "../helpers/cliTaskEventHandler"
import type { TaskEventHandlerOptions, MutableRef } from "../helpers/taskEventHandlerTypes"
import { waitForTaskCompletion, handleTimeout, closeAndDisconnect } from "../helpers/waitForCompletion"

function buildCliArgs(run: RunTaskOptions["run"], promptSourcePath: string, workspacePath: string): string[] {
	const cliArgs = [
		"--filter",
		"@jabberwock/cli",
		"start",
		"--prompt-file",
		promptSourcePath,
		"--workspace",
		workspacePath,
		"--reasoning-effort",
		"disabled",
		"--oneshot",
	]

	if (run.settings?.mode) {
		cliArgs.push("--mode", run.settings.mode)
	}

	if (run.settings?.apiProvider) {
		cliArgs.push("--provider", run.settings.apiProvider)
	}

	const modelId = run.settings?.apiModelId || run.settings?.openRouterModelId

	if (modelId) {
		cliArgs.push("--model", modelId)
	}

	return cliArgs
}

/**
 * Run a task using the Jabberwock CLI (headless mode).
 * Uses the same IPC protocol as VSCode since the CLI loads the same extension bundle.
 */
export const runTaskWithCli = async ({ run, task, publish, logger, jobToken }: RunTaskOptions) => {
	const { language, exercise } = task
	const promptSourcePath = path.resolve(EVALS_REPO_PATH, `prompts/${language}.md`)
	const workspacePath = path.resolve(EVALS_REPO_PATH, language, exercise)
	const ipcSocketPath = path.resolve(os.tmpdir(), `evals-cli-${run.id}-${task.id}.sock`)

	const env: Record<string, string> = {
		...(process.env as Record<string, string>),
		JABBERWOCK_CODE_IPC_SOCKET_PATH: ipcSocketPath,
	}

	if (jobToken) {
		env.JABBERWOCK_CODE_CLOUD_TOKEN = jobToken
	}

	const controller = new AbortController()
	const cancelSignal = controller.signal

	const cliArgs = buildCliArgs(run, promptSourcePath, workspacePath)

	logger.info(`CLI command: pnpm ${cliArgs.join(" ")}`)
	const subprocess = execa("pnpm", cliArgs, { env, cancelSignal, cwd: process.cwd() })

	setupStdioLogging(subprocess, logger)

	// Give CLI some time to start and create IPC server.
	await new Promise((resolve) => setTimeout(resolve, 5_000))

	const client = await connectToIpc({
		ipcSocketPath,
		logger,
		maxAttempts: 10,
		connectTimeout: 2_000,
		connectInterval: 500,
		retryDelay: 1_000,
	})

	// For CLI mode, create taskMetrics immediately because the CLI starts the task right away.
	const taskMetrics = await createTaskMetrics({
		cost: 0,
		tokensIn: 0,
		tokensOut: 0,
		tokensContext: 0,
		duration: 0,
		cacheWrites: 0,
		cacheReads: 0,
	})

	await updateTask(task.id, { taskMetricsId: taskMetrics.id, startedAt: new Date() })
	logger.info(`created taskMetrics with id ${taskMetrics.id}`)

	const taskStartedAt: MutableRef<number> = { current: Date.now() }
	const taskFinishedAt: MutableRef<number | undefined> = { current: undefined }
	const taskAbortedAt: MutableRef<number | undefined> = { current: undefined }
	const isClientDisconnected: MutableRef<boolean> = { current: false }
	const jabberwockTaskId: MutableRef<string | undefined> = { current: undefined }
	const isApiUnstable: MutableRef<boolean> = { current: false }
	const accumulatedToolUsage = {}

	const options: TaskEventHandlerOptions = {
		ipcSocketPath,
		logger,
		publish,
		taskStartedAt,
		taskFinishedAt,
		taskAbortedAt,
		isClientDisconnected,
		jabberwockTaskId,
		isApiUnstable,
		accumulatedToolUsage,
		taskMetricsId: taskMetrics.id,
	}

	registerCliTaskEventHandler({ client, options, taskId: task.id })

	const timeoutMs = (run.timeout || 5) * 60 * 1_000
	const taskTimedOut = await waitForTaskCompletion(
		() => !!taskFinishedAt.current || !!taskAbortedAt.current || isClientDisconnected.current,
		timeoutMs,
	)

	if (taskTimedOut) {
		logger.error("time limit reached")
		await handleTimeout({
			jabberwockTaskId,
			isClientDisconnected,
			sendCommand: client.sendCommand.bind(client),
			taskFinishedAt,
		})
	}

	if (!taskFinishedAt.current && !taskTimedOut) {
		logger.error("client disconnected before task finished")
		throw new Error("Client disconnected before task completion.")
	}

	logger.info("setting task finished at")
	await updateTask(task.id, { finishedAt: new Date() })

	await closeAndDisconnect({
		jabberwockTaskId: jabberwockTaskId.current,
		isClientDisconnected: isClientDisconnected.current,
		sendCommand: client.sendCommand.bind(client),
		disconnect: client.disconnect.bind(client),
		logger,
	})

	logger.info("waiting for subprocess to finish")
	controller.abort()

	await waitForSubprocessWithTimeout({ subprocess, logger })

	logger.close()

	if (isApiUnstable.current && !taskFinishedAt.current) {
		throw new Error("API is unstable, throwing to trigger a retry.")
	}
}
