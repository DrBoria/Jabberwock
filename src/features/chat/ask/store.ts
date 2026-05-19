import { types, getSnapshot } from "mobx-state-tree"
import type { EventBridge } from "../../../core/webview/EventBridge"
import type { Task } from "../task/Task"
import type {
	ClineAsk,
	ClineSay,
	ClineAskResponse,
	ToolProgressStatus,
	ContextCondense,
	ContextTruncation,
} from "@jabberwock/types"
import type { ToolName } from "@jabberwock/types"
import { getState } from "../../storeSingleton"
import {
	ask as askFromUtils,
	say as sayFromUtils,
	handleWebviewAskResponse as handleWebviewAskResponseFromUtils,
	sayAndCreateMissingParamError as sayAndCreateMissingParamErrorFromUtils,
} from "../task/utils/messaging"

// ─── Backward-compatible interface ─────────────────────────────────────
/** Reserved for future ask/say state properties */
export type AskState = object

// ─── MST Model (proper typed model, NOT frozen) ────────────────────────
export const AskModel = types.model("Ask", {})

// ─── Backward-compatible init/get ──────────────────────────────────────

export function initAskState(_provider: EventBridge): void {
	// MST default factory handles initialization
}

export function getAskState(provider: EventBridge): AskState {
	return getState(provider).chat.ask as AskState
}

/**
 * Asks the user a question.
 */
export async function ask(
	task: Task,
	type: ClineAsk,
	text?: string,
	partial?: boolean,
	progressStatus?: ToolProgressStatus,
	isProtected?: boolean,
): Promise<{ response: ClineAskResponse; text?: string; images?: string[] }> {
	return askFromUtils(task, type, text, partial, progressStatus, isProtected)
}

/**
 * Handles the webview's response to an ask.
 */
export function handleWebviewAskResponse(
	task: Task,
	response: ClineAskResponse,
	text?: string,
	images?: string[],
): void {
	handleWebviewAskResponseFromUtils(task, response, text, images)
}

/**
 * Sends a "say" message to the user.
 */
export async function say(
	task: Task,
	sayType: ClineSay,
	text?: string,
	images?: string[],
	partial?: boolean,
	checkpoint?: Record<string, unknown>,
	progressStatus?: ToolProgressStatus,
	options?: { isNonInteractive?: boolean },
	contextCondense?: ContextCondense,
	contextTruncation?: ContextTruncation,
): Promise<undefined> {
	return sayFromUtils(
		task,
		sayType,
		text,
		images,
		partial,
		checkpoint,
		progressStatus,
		options ?? {},
		contextCondense,
		contextTruncation,
	)
}

/**
 * Sends a message saying a required parameter is missing.
 */
export async function sayAndCreateMissingParamError(
	task: Task,
	toolName: ToolName,
	paramName: string,
	relPath?: string,
): Promise<string> {
	return sayAndCreateMissingParamErrorFromUtils(task, toolName, paramName, relPath)
}
