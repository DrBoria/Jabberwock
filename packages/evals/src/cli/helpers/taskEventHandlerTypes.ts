import type { ToolUsage, TaskEvent, JabberwockEventName } from "@jabberwock/types"

import { Logger } from "./logging/logger"
import { MessageLogDeduper } from "../messageLogDeduper"

export interface MutableRef<T> {
	current: T
}

export interface TaskEventHandlerOptions {
	ipcSocketPath: string
	logger: Logger
	publish: (taskEvent: TaskEvent) => Promise<void>
	taskStartedAt: MutableRef<number>
	taskFinishedAt: MutableRef<number | undefined>
	taskAbortedAt: MutableRef<number | undefined>
	isClientDisconnected: MutableRef<boolean>
	jabberwockTaskId: MutableRef<string | undefined>
	isApiUnstable: MutableRef<boolean>
	accumulatedToolUsage: ToolUsage
	taskMetricsId: number
}

export interface VscodeTaskEventHandlerOptions {
	ipcSocketPath: string
	logger: Logger
	publish: (taskEvent: TaskEvent) => Promise<void>
	taskStartedAt: MutableRef<number>
	taskFinishedAt: MutableRef<number | undefined>
	taskAbortedAt: MutableRef<number | undefined>
	isClientDisconnected: MutableRef<boolean>
	jabberwockTaskId: MutableRef<string | undefined>
	isApiUnstable: MutableRef<boolean>
	accumulatedToolUsage: ToolUsage
	taskMetricsId: MutableRef<number | undefined>
	taskMetricsReady: Promise<void>
	resolveTaskMetricsReady: () => void
	ignoreEvents: Record<"broadcast" | "log", JabberwockEventName[]>
	messageLogDeduper: MessageLogDeduper
}
