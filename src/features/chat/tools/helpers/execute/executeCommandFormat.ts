import * as path from "path"

import { PersistedCommandOutput } from "@jabberwock/types"

import { ExitCodeDetails } from "@integrations/terminal/types"

import { ToolResponse } from "@shared/tools"
import { formatResponse } from "@features/settings/context/responses"

import type { CommandOutputState } from "./executeCommandState"
import { formatBytes } from "@features/chat/tools/helpers/shared"

export function formatCommandResult(state: CommandOutputState, workingDir: string): [boolean, ToolResponse] {
	if (state.message) {
		const { text, images } = state.message

		return [
			true,
			formatResponse.toolResult(
				[
					`Command is still running in terminal from '${workingDir.toPosix()}'.`,
					state.result.length > 0 ? `Here's the output so far:\n${state.result}\n` : "\n",
					`<user_message>\n${text}\n</user_message>`,
				].join("\n"),
				images,
			),
		]
	}

	if (state.completed || state.exitDetails) {
		return formatCompletedResult(state, workingDir)
	}

	return [
		false,
		[
			`Command is still running in terminal ${workingDir ? ` from '${workingDir.toPosix()}'` : ""}.`,
			state.result.length > 0 ? `Here's the output so far:\n${state.result}\n` : "\n",
			"You will be updated on the terminal status and new output in the future.",
		].join("\n"),
	]
}

function formatCompletedResult(state: CommandOutputState, workingDir: string): [boolean, ToolResponse] {
	if (state.persistedResult?.truncated) {
		return [false, formatPersistedOutput(state.persistedResult, state.exitDetails, workingDir)]
	}

	let exitStatus = formatExitStatus(state.exitDetails)

	if (state.exitDetails === undefined || state.exitDetails.exitCode === undefined) {
		state.result += "<VSCE exit code is undefined: terminal output and command execution status is unknown.>"
	}

	return [
		false,
		`Command executed in terminal within working directory '${workingDir.toPosix()}'. ${exitStatus}\nOutput:\n${state.result}`,
	]
}

export function formatExitStatus(exitDetails: ExitCodeDetails | undefined): string {
	if (exitDetails === undefined) {
		return "Exit code: <undefined, notify user>"
	}

	if (exitDetails.signalName) {
		let status = `Process terminated by signal ${exitDetails.signalName}`
		if (exitDetails.coreDumpPossible) {
			status += " - core dump possible"
		}
		return status
	}

	if (exitDetails.exitCode === undefined) {
		return "Exit code: <undefined, notify user>"
	}

	let status = ""
	if (exitDetails.exitCode !== 0) {
		status += "Command execution was not successful, inspect the cause and adjust as needed.\n"
	}
	status += `Exit code: ${exitDetails.exitCode}`
	return status
}

export function formatPersistedOutput(
	result: PersistedCommandOutput,
	exitDetails: ExitCodeDetails | undefined,
	workingDir: string,
): string {
	const exitStatus = formatExitStatus(exitDetails)
	const sizeStr = formatBytes(result.totalBytes)
	const artifactId = result.artifactPath ? path.basename(result.artifactPath) : ""

	return [
		`Command executed in '${workingDir}'. ${exitStatus}`,
		"",
		`Output (${sizeStr}) persisted. Artifact ID: ${artifactId}`,
		"",
		"Preview:",
		result.preview,
		"",
		"Use read_command_output tool to view full output if needed.",
	].join("\n")
}

export { formatBytes }
