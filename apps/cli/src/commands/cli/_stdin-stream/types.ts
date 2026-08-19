import { rooCliCommandNames } from "@jabberwock/types"
import type { RooCliCommandName, RooCliInputCommand } from "@jabberwock/types"
import type { ExtensionHost } from "@/agent/index.js"
import type { JsonEventEmitter } from "@/agent/json/index.js"

export type StdinStreamCommandName = RooCliCommandName
export type StdinStreamCommand = RooCliInputCommand

export const VALID_STDIN_COMMANDS = new Set<StdinStreamCommandName>(rooCliCommandNames)

export interface StreamQueueItem {
	id: string
	text?: string
	imageCount: number
	timestamp?: number
}

export interface StdinStreamModeOptions {
	host: ExtensionHost
	jsonEmitter: JsonEventEmitter
	setStreamRequestId: (id: string | undefined) => void
}

export const RESUME_ASKS = new Set(["resume_task", "resume_completed_task"])
export const CANCEL_RECOVERY_WAIT_TIMEOUT_MS = 8_000
export const CANCEL_RECOVERY_POLL_INTERVAL_MS = 100
export const STDIN_EOF_RESUME_WAIT_TIMEOUT_MS = 2_000
export const STDIN_EOF_POLL_INTERVAL_MS = 100
export const STDIN_EOF_IDLE_ASKS = new Set(["completion_result", "resume_completed_task"])
export const STDIN_EOF_IDLE_STABLE_POLLS = 2
export const MESSAGE_AS_ASK_RESPONSE_ASKS = new Set([
	"followup",
	"tool",
	"command",
	"use_mcp_server",
	"completion_result",
	"resume_task",
	"resume_completed_task",
	"mistake_limit_reached",
])
