import pWaitFor from "p-wait-for"

import { IpcClient } from "@jabberwock/ipc"

import { Logger } from "./logging/logger"

export async function connectToIpc({
	ipcSocketPath,
	logger,
	maxAttempts,
	connectTimeout = 1_000,
	connectInterval = 250,
	retryDelay = 0,
}: {
	ipcSocketPath: string
	logger: Logger
	maxAttempts: number
	connectTimeout?: number
	connectInterval?: number
	retryDelay?: number
}): Promise<IpcClient> {
	let client: IpcClient | undefined

	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		try {
			client = new IpcClient(ipcSocketPath)
			await pWaitFor(() => client!.isReady, { interval: connectInterval, timeout: connectTimeout })
			return client
		} catch (_error) {
			client?.disconnect()

			if (retryDelay > 0) {
				await new Promise((resolve) => setTimeout(resolve, retryDelay))
			}
		}
	}

	logger.error(`unable to connect to IPC socket -> ${ipcSocketPath}`)
	throw new Error("Unable to connect to IPC socket.")
}
