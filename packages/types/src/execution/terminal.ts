import { z } from "zod"

/**
 * CommandExecutionStatus
 */

export const commandExecutionStatusSchema = z.discriminatedUnion("status", [
	z.object({
		executionId: z.string(),
		status: z.literal("started"),
		pid: z.number().optional(),
		command: z.string(),
	}),
	z.object({
		executionId: z.string(),
		status: z.literal("output"),
		output: z.string(),
	}),
	z.object({
		executionId: z.string(),
		status: z.literal("exited"),
		exitCode: z.number().optional(),
	}),
	z.object({
		executionId: z.string(),
		status: z.literal("fallback"),
	}),
	z.object({
		executionId: z.string(),
		status: z.literal("timeout"),
	}),
])

export type CommandExecutionStatus = z.infer<typeof commandExecutionStatusSchema>

/**
 * PersistedCommandOutput
 *
 * Represents the result of a terminal command execution that may have been
 * truncated and persisted to disk.
 *
 * When command output exceeds the configured preview threshold, the full
 * output is saved to a disk artifact file. The LLM receives this structure
 * which contains:
 * - A preview of the output (for immediate display in context)
 * - Metadata about the full output (size, truncation status)
 * - A path to the artifact file for later retrieval via `read_command_output`
 *
 * ## Usage in execute_command Response
 *
 * The response format depends on whether truncation occurred:
 *
 * **Not truncated** (output fits in preview):
 * ```json
 * {
 *   "preview": "full output here...",
 *   "totalBytes": 1234,
 *   "artifactPath": null,
 *   "truncated": false
 * }
 * ```
 *
 * **Truncated** (output exceeded threshold):
 * ```json
 * {
 *   "preview": "first 4KB of output...",
 *   "totalBytes": 1048576,
 *   "artifactPath": "/path/to/tasks/123/command-output/cmd-1706119234567.txt",
 *   "truncated": true
 * }
 * ```
 *
 * @see OutputInterceptor - Creates these results during command execution
 * @see ReadCommandOutputTool - Retrieves full content from artifact files
 */
export interface PersistedCommandOutput {
	/**
	 * Preview of the command output, truncated to the preview threshold.
	 * Always contains the beginning of the output, even if truncated.
	 */
	preview: string

	/**
	 * Total size of the command output in bytes.
	 * Useful for determining if additional reads are needed.
	 */
	totalBytes: number

	/**
	 * Absolute path to the artifact file containing full output.
	 * `null` if output wasn't truncated (no artifact was created).
	 */
	artifactPath: string | null

	/**
	 * Whether the output was truncated (exceeded preview threshold).
	 * When `true`, use `read_command_output` to retrieve full content.
	 */
	truncated: boolean
}

// ---------------------------------------------------------------------------
// Terminal host-abstraction types (D4g-2 batch 4)
//
// These types were moved from `backend/integrations/terminal/types.ts` so the
// `IHostTerminalService` seam in `protocol/backend-connector.ts` can reference
// them without importing from the backend tree (layering: types is the lowest
// layer). The original file is now a re-export.
// ---------------------------------------------------------------------------

import type { EventEmitter } from "events"

export type RooTerminalProvider = "vscode" | "execa"

export interface RooTerminal {
	provider: RooTerminalProvider
	id: number
	busy: boolean
	running: boolean
	taskId?: string
	process?: JabberwockTerminalProcess
	getCurrentWorkingDirectory(): string
	isClosed: () => boolean
	runCommand: (command: string, callbacks: RooTerminalCallbacks) => JabberwockTerminalProcessResultPromise
	setActiveStream(stream: AsyncIterable<string> | undefined, pid?: number): void
	shellExecutionComplete(exitDetails: ExitCodeDetails): void
	getProcessesWithOutput(): JabberwockTerminalProcess[]
	getUnretrievedOutput(): string
	getLastCommand(): string
	cleanCompletedProcessQueue(): void
}

export interface RooTerminalCallbacks {
	onLine: (line: string, process: JabberwockTerminalProcess) => void
	onCompleted: (output: string | undefined, process: JabberwockTerminalProcess) => void | Promise<void>
	onShellExecutionStarted: (pid: number | undefined, process: JabberwockTerminalProcess) => void
	onShellExecutionComplete: (details: ExitCodeDetails, process: JabberwockTerminalProcess) => void
	onNoShellIntegration?: (message: string, process: JabberwockTerminalProcess) => void
}

export interface JabberwockTerminalProcess extends EventEmitter<JabberwockTerminalProcessEvents> {
	command: string
	isHot: boolean
	run: (command: string) => Promise<void>
	continue: () => void
	abort: () => void
	hasUnretrievedOutput: () => boolean
	getUnretrievedOutput: () => string
	trimRetrievedOutput: () => void
}

export type JabberwockTerminalProcessResultPromise = JabberwockTerminalProcess & Promise<void>

export interface JabberwockTerminalProcessEvents {
	line: [line: string]
	continue: []
	completed: [output?: string]
	stream_available: [stream: AsyncIterable<string>]
	shell_execution_started: [pid: number | undefined]
	shell_execution_complete: [exitDetails: ExitCodeDetails]
	error: [error: Error]
	no_shell_integration: [message: string]
}

export interface ExitCodeDetails {
	exitCode: number | undefined
	signal?: number | undefined
	signalName?: string
	coreDumpPossible?: boolean
}
