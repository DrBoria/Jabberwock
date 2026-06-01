import { type Notification } from "@jabberwock/types"
import { readTaskMessages } from "."

/**
 * Gets saved messages from disk.
 */
export async function getSavedMessages(taskId: string, globalStoragePath: string): Promise<Notification[]> {
	return readTaskMessages({ taskId, globalStoragePath })
}
