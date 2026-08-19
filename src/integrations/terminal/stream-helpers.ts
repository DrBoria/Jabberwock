import { inspect } from "util"

import type EventEmitter from "events"

import { matchVsceMarkers, stripCursorSequences, removeVSCodeShellIntegration } from "./vsce-markers"

/**
 * Creates a promise that resolves when a terminal stream becomes available.
 * Rejects with a timeout error if the stream doesn't start within the timeout period.
 */
export function createStreamPromise(
	emitter: EventEmitter,
	getShellIntegrationTimeout: () => number,
): Promise<AsyncIterable<string>> {
	return new Promise<AsyncIterable<string>>((resolve, reject) => {
		const timeoutId = setTimeout(() => {
			emitter.removeAllListeners("stream_available")

			emitter.emit(
				"no_shell_integration",
				`VSCE shell integration stream did not start within ${getShellIntegrationTimeout() / 1000} seconds. Terminal problem?`,
			)

			reject(
				new Error(
					`VSCE shell integration stream did not start within ${getShellIntegrationTimeout() / 1000} seconds.`,
				),
			)
		}, getShellIntegrationTimeout())

		emitter.once("stream_available", (stream: AsyncIterable<string>) => {
			clearTimeout(timeoutId)
			resolve(stream)
		})
	})
}

/**
 * Awaits the stream promise and handles errors by emitting
 * completion events and continuing the process.
 */
export function awaitStreamOrHandleError(
	emitter: EventEmitter,
	streamAvailable: Promise<AsyncIterable<string>>,
	onCompleted: (output: string) => void,
	onContinue: () => void,
): Promise<AsyncIterable<string> | undefined> {
	return streamAvailable
		.then((stream) => stream)
		.catch((error) => {
			console.error("[jabberwock] [Terminal Process] Stream error:", (error as Error).message)

			onCompleted(
				"<VSCE shell integration stream did not start: terminal output and command execution status is unknown>",
			)

			onContinue()

			return undefined
		})
}

/**
 * Process terminal stream data, extracting command output from VSCE markers.
 * Returns whether command output started and any pre-output content.
 */
export async function processStreamData(
	emitter: EventEmitter,
	stream: AsyncIterable<string>,
	fullOutputRef: { current: string },
	isListening: () => boolean,
	lastEmitTimeMs: () => number,
	emitLine: (line: string) => void,
	startHotTimer: (data: string) => void,
): Promise<{ commandOutputStarted: boolean; preOutput: string }> {
	let preOutput = ""
	let commandOutputStarted = false

	for await (let data of stream) {
		if (!commandOutputStarted) {
			preOutput += data
			const match = matchVsceMarkers(data, ["\x1b]633;C", "\x1b]133;C"])

			if (match !== undefined) {
				commandOutputStarted = true
				data = match
				fullOutputRef.current = ""
				emitLine("")
			} else {
				continue
			}
		}

		fullOutputRef.current += data

		const now = Date.now()

		if (isListening() && (now - lastEmitTimeMs() > 100 || lastEmitTimeMs() === 0)) {
			emitLine("") // signal to emit remaining buffer
			// Note: lastEmitTime_ms is updated by the caller
		}

		startHotTimer(data)
	}

	return { commandOutputStarted, preOutput }
}

/**
 * Handle the case where command output markers were not found
 * in the stream despite the stream having started.
 */
export function handleMissingCommandOutput(
	emitter: EventEmitter,
	preOutput: string,
	onCompleted: (output: string) => void,
	onContinue: () => void,
): void {
	const errorMsg =
		"VSCE output start escape sequence (]633;C or ]133;C) not received, but the stream has started. Upstream VSCE Bug?"

	const inspectPreOutput = inspect(preOutput, { colors: false, breakLength: Infinity })

	console.error(`[jabberwock] [Terminal Process] ${errorMsg} preOutput: ${inspectPreOutput}`)

	emitter.emit("no_shell_integration", errorMsg)

	onCompleted(
		"<VSCE shell integration markers not found: terminal output and command execution status is unknown>\n" +
			`<preOutput>${inspectPreOutput}</preOutput>\n` +
			"AI MODEL: You MUST notify the user with the information above so they can open a bug report.",
	)

	onContinue()
}

/**
 * Get unretrieved output from the full output buffer, stripping
 * VSCode shell integration markers and cursor sequences.
 */
export function getUnretrievedOutput(
	fullOutput: string,
	lastRetrievedIndex: number,
	isStreamClosed: boolean,
): { output: string; newLastRetrievedIndex: number } {
	let outputToProcess = fullOutput.slice(lastRetrievedIndex)

	const index633 = outputToProcess.indexOf("\x1b]633;D")
	const index133 = outputToProcess.indexOf("\x1b]133;D")
	let endIndex = -1

	if (index633 !== -1 && index133 !== -1) {
		endIndex = Math.min(index633, index133)
	} else if (index633 !== -1) {
		endIndex = index633
	} else if (index133 !== -1) {
		endIndex = index133
	}

	if (endIndex === -1) {
		if (!isStreamClosed) {
			endIndex = outputToProcess.lastIndexOf("\n")

			if (endIndex === -1) {
				return { output: "", newLastRetrievedIndex: lastRetrievedIndex }
			}

			endIndex++
		} else {
			endIndex = outputToProcess.length
		}
	}

	const newLastRetrievedIndex = lastRetrievedIndex + endIndex
	outputToProcess = outputToProcess.slice(0, endIndex)

	return {
		output: stripCursorSequences(removeVSCodeShellIntegration(outputToProcess)),
		newLastRetrievedIndex,
	}
}
