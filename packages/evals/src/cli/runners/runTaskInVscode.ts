import * as fs from "fs"
import * as path from "path"
import * as os from "node:os"

import { execa, type ResultPromise } from "execa"

import { TaskCommandName, JabberwockEventName, EVALS_SETTINGS, type TaskCommand } from "@jabberwock/types"

import { updateTask } from "../../db/index"
import { EVALS_REPO_PATH } from "../../exercises/index"

import { type RunTaskOptions } from "../types"
import { Logger } from "../helpers/logging/logger"
import { isDockerContainer, copyConversationHistory, waitForSubprocessWithTimeout } from "../utils"
import { connectToIpc } from "../helpers/connectToIpc"
import { registerVscodeTaskEventHandler } from "../helpers/vscodeTaskEventHandler"
import type { VscodeTaskEventHandlerOptions, MutableRef } from "../helpers/taskEventHandlerTypes"
import { waitForTaskCompletion, handleTimeout, closeAndDisconnect } from "../helpers/waitForCompletion"
import { MessageLogDeduper } from "../messageLogDeduper"

function buildCodeCommand({
	containerized,
	workspacePath,
	jobToken,
}: {
	containerized: boolean
	workspacePath: string
	jobToken: string | null
}): string {
	let codeCommand = containerized
		? `xvfb-run --auto-servernum --server-num=1 code --wait --log trace --disable-workspace-trust --disable-gpu --disable-lcd-text --no-sandbox --user-data-dir /jabberwock/.vscode --password-store="basic" -n ${workspacePath}`
		: `code --disable-workspace-trust -n ${workspacePath}`

	if (jobToken) {
		codeCommand = `JABBERWOCK_CODE_CLOUD_TOKEN=${jobToken} ${codeCommand}`
	}

	return codeCommand
}

async function awaitVscodeTaskCompletion({
	subprocess,
	controller,
	containerized,
	jabberwockTaskId,
	logDir,
	language,
	exercise,
	iteration,
	logger,
	taskId,
	isClientDisconnected,
	sendCommand,
	disconnect,
	taskFinishedAt,
	isApiUnstable,
	taskTimedOut,
}: {
	subprocess: ResultPromise
	controller: AbortController
	containerized: boolean
	jabberwockTaskId: MutableRef<string | undefined>
	logDir: string
	language: string
	exercise: string
	iteration: number
	logger: Logger
	taskId: number
	isClientDisconnected: MutableRef<boolean>
	sendCommand: (command: TaskCommand) => void
	disconnect: () => void
	taskFinishedAt: MutableRef<number | undefined>
	isApiUnstable: MutableRef<boolean>
	taskTimedOut: boolean
}): Promise<void> {
	if (taskTimedOut) {
		logger.error("time limit reached")
		await handleTimeout({ jabberwockTaskId, isClientDisconnected, sendCommand, taskFinishedAt })
	}

	if (!taskFinishedAt.current && !taskTimedOut) {
		logger.error("client disconnected before task finished")
		throw new Error("Client disconnected before task completion.")
	}

	logger.info("setting task finished at")
	await updateTask(taskId, { finishedAt: new Date() })

	await closeAndDisconnect({
		jabberwockTaskId: jabberwockTaskId.current,
		isClientDisconnected: isClientDisconnected.current,
		sendCommand,
		disconnect,
		logger,
	})

	logger.info("waiting for subprocess to finish")
	controller.abort()

	await waitForSubprocessWithTimeout({ subprocess, logger })

	if (containerized && jabberwockTaskId.current) {
		await copyConversationHistory({
			jabberwockTaskId: jabberwockTaskId.current,
			logDir,
			language,
			exercise,
			iteration,
			logger,
		})
	}

	logger.close()

	if (isApiUnstable.current && !taskFinishedAt.current) {
		throw new Error("API is unstable, throwing to trigger a retry.")
	}
}

export const runTaskInVscode = async ({ run, task, publish, logger, jobToken }: RunTaskOptions) => {
	const { language, exercise } = task
	const prompt = fs.readFileSync(path.resolve(EVALS_REPO_PATH, `prompts/${language}.md`), "utf-8")
	const workspacePath = path.resolve(EVALS_REPO_PATH, language, exercise)
	const ipcSocketPath = path.resolve(os.tmpdir(), `evals-${run.id}-${task.id}.sock`)
	const env = { JABBERWOCK_CODE_IPC_SOCKET_PATH: ipcSocketPath }
	const controller = new AbortController()
	const cancelSignal = controller.signal
	const containerized = isDockerContainer()
	const logDir = containerized ? `/var/log/evals/runs/${run.id}` : `/tmp/evals/runs/${run.id}`

	const codeCommand = buildCodeCommand({ containerized, workspacePath, jobToken })

	logger.info(codeCommand)

	if (!containerized) {
		await new Promise((resolve) => setTimeout(resolve, Math.random() * 5_000 + 5_000))
	}

	const subprocess = execa({ env, shell: "/bin/bash", cancelSignal })`${codeCommand}`

	// Give VSCode some time to spawn before connecting to its unix socket.
	await new Promise((resolve) => setTimeout(resolve, 3_000))

	const client = await connectToIpc({
		ipcSocketPath,
		logger,
		maxAttempts: 5,
		connectTimeout: 1_000,
		connectInterval: 250,
	})

	const taskStartedAt: MutableRef<number> = { current: Date.now() }
	const taskFinishedAt: MutableRef<number | undefined> = { current: undefined }
	const taskAbortedAt: MutableRef<number | undefined> = { current: undefined }
	const isClientDisconnected: MutableRef<boolean> = { current: false }
	const jabberwockTaskId: MutableRef<string | undefined> = { current: undefined }
	const isApiUnstable: MutableRef<boolean> = { current: false }
	const accumulatedToolUsage = {}
	const taskMetricsId: MutableRef<number | undefined> = { current: undefined }

	let resolveTaskMetricsReady!: () => void
	const taskMetricsReady = new Promise<void>((resolve) => {
		resolveTaskMetricsReady = resolve
	})

	const ignoreEvents: Record<"broadcast" | "log", JabberwockEventName[]> = {
		broadcast: [JabberwockEventName.Message],
		log: [JabberwockEventName.TaskTokenUsageUpdated, JabberwockEventName.TaskAskResponded],
	}

	const messageLogDeduper = new MessageLogDeduper()

	const options: VscodeTaskEventHandlerOptions = {
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
		taskMetricsId,
		taskMetricsReady,
		resolveTaskMetricsReady,
		ignoreEvents,
		messageLogDeduper,
	}

	registerVscodeTaskEventHandler({ client, options, taskId: task.id })

	client.sendCommand({
		commandName: TaskCommandName.StartNewTask,
		data: {
			configuration: {
				...EVALS_SETTINGS,
				allowedCommands: [...EVALS_SETTINGS.allowedCommands],
				commandTimeoutAllowlist: [...EVALS_SETTINGS.commandTimeoutAllowlist],
				openRouterApiKey: process.env.OPENROUTER_API_KEY,
				...run.settings,
			},
			text: prompt,
		},
	})

	const timeoutMs = (run.timeout || 5) * 60 * 1_000
	const taskTimedOut = await waitForTaskCompletion(
		() => !!taskFinishedAt.current || !!taskAbortedAt.current || isClientDisconnected.current,
		timeoutMs,
	)

	await awaitVscodeTaskCompletion({
		subprocess,
		controller,
		containerized,
		jabberwockTaskId,
		logDir,
		language,
		exercise,
		iteration: task.iteration,
		logger,
		taskId: task.id,
		isClientDisconnected,
		sendCommand: client.sendCommand.bind(client),
		disconnect: client.disconnect.bind(client),
		taskFinishedAt,
		isApiUnstable,
		taskTimedOut,
	})
}
