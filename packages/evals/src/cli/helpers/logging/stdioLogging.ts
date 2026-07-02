import type { ResultPromise } from "execa"

import { Logger } from "./logger"
import type { MutableRef } from "../taskEventHandlerTypes"

export function setupStdioLogging(
	subprocess: ResultPromise,
	logger: Logger,
): { subprocessExitCode: MutableRef<number | null> } {
	let stdoutBuffer = ""
	let stderrBuffer = ""
	const subprocessExitCode: MutableRef<number | null> = { current: null }

	subprocess.stdout?.on("data", (data: Buffer) => {
		stdoutBuffer += data.toString()
		const lines = stdoutBuffer.split("\n")
		stdoutBuffer = lines.pop() || ""

		for (const line of lines) {
			if (line.trim()) {
				logger.raw(line)
			}
		}
	})

	subprocess.stderr?.on("data", (data: Buffer) => {
		stderrBuffer += data.toString()
		const lines = stderrBuffer.split("\n")
		stderrBuffer = lines.pop() || ""

		for (const line of lines) {
			if (line.trim()) {
				logger.raw(line)
			}
		}
	})

	subprocess.on("exit", (code) => {
		subprocessExitCode.current = code

		if (stdoutBuffer.trim()) {
			logger.raw(stdoutBuffer)
		}

		if (stderrBuffer.trim()) {
			logger.raw(stderrBuffer)
		}
	})

	return { subprocessExitCode }
}
