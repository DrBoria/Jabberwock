import type { ITaskModel } from "@features/chat/task/store"

import { sendCheckpointInitWarning } from "@features/foundation/time-machine/events/actions/sendCheckpointEvent"

export const WARNING_THRESHOLD_MS = 5000

/** @deprecated Use sendCheckpointInitWarning from event actions instead */
export function sendCheckpointInitWarn(_task: ITaskModel, type?: "WAIT_TIMEOUT" | "INIT_TIMEOUT", timeout?: number) {
	sendCheckpointInitWarning(type, timeout)
}
