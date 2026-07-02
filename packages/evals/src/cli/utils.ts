import * as fs from "fs"
import * as fsp from "fs/promises"
import * as path from "path"

import type { ResultPromise } from "execa"

import type { ToolUsage } from "@jabberwock/types"

import type { Run, Task } from "../db/index"

import { SubprocessTimeoutError } from "./types"
import { Logger } from "./helpers/logging/logger"

export const getTag = (caller: string, { run, task }: { run: Run; task?: Task }) =>
	task
		? `${caller} | pid:${process.pid} | run:${run.id} | task:${task.id} | ${task.language}/${task.exercise}`
		: `${caller} | pid:${process.pid} | run:${run.id}`

export const isDockerContainer = () => {
	try {
		return fs.existsSync("/.dockerenv")
	} catch (_error) {
		return false
	}
}

/**
 * Copy conversation history files from VS Code extension storage to the log directory.
 * This allows us to preserve the api_conversation_history.json and ui_messages.json
 * files for post-mortem analysis alongside the log files.
 */
export async function copyConversationHistory({
	jabberwockTaskId,
	logDir,
	language,
	exercise,
	iteration,
	logger,
}: {
	jabberwockTaskId: string
	logDir: string
	language: string
	exercise: string
	iteration: number
	logger: Logger
}): Promise<void> {
	// VS Code extension global storage path within the container
	const extensionStoragePath = "/jabberwock/.vscode/User/globalStorage/rooveterinaryinc.jabberwock"
	const taskStoragePath = path.join(extensionStoragePath, "tasks", jabberwockTaskId)

	const filesToCopy = ["api_conversation_history.json", "ui_messages.json"]

	for (const filename of filesToCopy) {
		const sourcePath = path.join(taskStoragePath, filename)
		// Use sanitized exercise name (replace slashes with dashes) for the destination filename
		// Include iteration number to handle multiple attempts at the same exercise
		const sanitizedExercise = exercise.replace(/\//g, "-")
		const destFilename = `${language}-${sanitizedExercise}.${iteration}_${filename}`
		const destPath = path.join(logDir, destFilename)

		try {
			// Check if source file exists
			await fsp.access(sourcePath)

			// Copy the file
			await fsp.copyFile(sourcePath, destPath)
			logger.info(`copied ${filename} to ${destPath}`)
		} catch (error) {
			// File may not exist if task didn't complete properly - this is not fatal
			if ((error as NodeJS.ErrnoException).code === "ENOENT") {
				logger.info(`${filename} not found at ${sourcePath} - skipping`)
			} else {
				logger.error(`failed to copy ${filename}:`, error)
			}
		}
	}
}

/**
 * Merge incoming tool usage with accumulated data using MAX strategy.
 * This handles the case where a task is rehydrated after abort:
 * - Empty rehydrated data won't overwrite existing: max(5, 0) = 5
 * - Legitimate restart with additional work is captured: max(5, 8) = 8
 * Each task instance tracks its own cumulative values, so we take the max
 * to preserve the highest values seen across all instances.
 */
export function mergeToolUsage(accumulated: ToolUsage, incoming: ToolUsage): void {
	for (const [toolName, usage] of Object.entries(incoming)) {
		const existing = accumulated[toolName as keyof ToolUsage]

		if (existing) {
			accumulated[toolName as keyof ToolUsage] = {
				attempts: Math.max(existing.attempts, usage.attempts),
				failures: Math.max(existing.failures, usage.failures),
			}
		} else {
			accumulated[toolName as keyof ToolUsage] = { ...usage }
		}
	}
}

/**
 * Wait for a subprocess to finish gracefully, with a timeout.
 * If the subprocess doesn't finish within the timeout, force kill it with SIGKILL.
 */
export async function waitForSubprocessWithTimeout({
	subprocess,
	timeoutMs = 10_000,
	logger,
}: {
	subprocess: ResultPromise
	timeoutMs?: number
	logger: Logger
}): Promise<void> {
	try {
		await Promise.race([
			subprocess,
			new Promise((_, reject) => setTimeout(() => reject(new SubprocessTimeoutError(timeoutMs)), timeoutMs)),
		])

		logger.info("subprocess finished gracefully")
	} catch (error) {
		if (error instanceof SubprocessTimeoutError) {
			logger.error("subprocess did not finish within timeout, force killing")

			try {
				if (subprocess.kill("SIGKILL")) {
					logger.info("SIGKILL sent to subprocess")
				} else {
					logger.error("failed to send SIGKILL to subprocess")
				}
			} catch (killError) {
				logger.error("subprocess.kill(SIGKILL) failed:", killError)
			}
		} else {
			throw error
		}
	}
}
