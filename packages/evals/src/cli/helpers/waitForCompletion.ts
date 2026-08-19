import pWaitFor from "p-wait-for"

import { TaskCommandName, type TaskCommand } from "@jabberwock/types"

import type { MutableRef } from "./taskEventHandlerTypes"

export async function waitForTaskCompletion(condition: () => boolean, timeoutMs: number): Promise<boolean> {
	try {
		await pWaitFor(condition, {
			interval: 1_000,
			timeout: timeoutMs,
		})
		return false
	} catch {
		return true
	}
}

export async function handleTimeout({
	jabberwockTaskId,
	isClientDisconnected,
	sendCommand,
	taskFinishedAt,
}: {
	jabberwockTaskId: MutableRef<string | undefined>
	isClientDisconnected: MutableRef<boolean>
	sendCommand: (cmd: TaskCommand) => void
	taskFinishedAt: MutableRef<number | undefined>
}): Promise<void> {
	if (jabberwockTaskId.current && !isClientDisconnected.current) {
		sendCommand({ commandName: TaskCommandName.CancelTask })
		await new Promise((resolve) => setTimeout(resolve, 5_000))
	}

	taskFinishedAt.current = Date.now()
}

export async function closeAndDisconnect({
	jabberwockTaskId,
	isClientDisconnected,
	sendCommand,
	disconnect,
	logger,
}: {
	jabberwockTaskId: string | undefined
	isClientDisconnected: boolean
	sendCommand: (cmd: TaskCommand) => void
	disconnect: () => void
	logger: { info: (msg: string) => void }
}): Promise<void> {
	if (jabberwockTaskId && !isClientDisconnected) {
		logger.info("closing task")
		sendCommand({ commandName: TaskCommandName.CloseTask })
		await new Promise((resolve) => setTimeout(resolve, 2_000))
	}

	if (!isClientDisconnected) {
		logger.info("disconnecting client")
		disconnect()
	}
}
