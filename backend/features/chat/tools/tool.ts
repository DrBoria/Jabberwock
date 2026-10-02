import type { ToolName } from "@jabberwock/types"

import type { ITaskModel } from "@features/chat/task"
import type { ToolUse, HandleError, PushToolResult, AskApproval, NativeToolArgs } from "@shared/tools"

/**
 * Callbacks passed to tool execution
 */
export interface ToolCallbacks {
	askApproval: AskApproval
	handleError: HandleError
	pushToolResult: PushToolResult
	toolCallId?: string
}

/**
 * Helper type to extract the parameter type for a tool based on its name.
 * If the tool has native args defined in NativeToolArgs, use those; otherwise fall back to never.
 */
export type ToolParams<TName extends ToolName> = TName extends keyof NativeToolArgs ? NativeToolArgs[TName] : never

/**
 * A tool: a plain object with a name, an execute function, and optional
 * partial-message handling. Replaces the former `BaseTool` abstract class
 * (doctrine: no classes — abstract base + concrete = NEVER).
 *
 * The shared runtime (handle / hasPathStabilized / resetPartialState) is
 * provided by `createTool` and attached to each tool object, so tool files
 * only carry their own `execute` (and optional `handlePartial`) logic.
 */
export interface Tool<TName extends ToolName> {
	readonly name: TName
	execute(params: ToolParams<TName>, task: ITaskModel, callbacks: ToolCallbacks): Promise<void>
	handlePartial?(task: ITaskModel, block: ToolUse<TName>): Promise<void>
	handle(task: ITaskModel, block: ToolUse<TName>, callbacks: ToolCallbacks): Promise<void>
	hasPathStabilized(path: string | undefined): boolean
	resetPartialState(): void
}

/**
 * Tracks the last seen path during streaming to detect when the path has
 * stabilized. Used by `hasPathStabilized` to prevent displaying truncated
 * paths from "partial-json" parsing. Transient per-invocation state, reset
 * after each `execute`.
 */
interface PartialPathTracker {
	lastSeenPartialPath: string | undefined
}

/**
 * Create a tool object with the shared runtime attached. The `execute` (and
 * optional `handlePartial`) are the tool's own logic; `handle`,
 * `hasPathStabilized`, and `resetPartialState` are provided here.
 *
 * `this` inside `execute`/`handlePartial` refers to the tool object, so
 * `this.name`, `this.hasPathStabilized(...)`, and `this.resetPartialState()`
 * all work unchanged from the former class form.
 */
export function createTool<TName extends ToolName, Extras extends object = object>(
	definition: {
		readonly name: TName
		execute(
			this: Tool<TName> & Extras,
			params: ToolParams<TName>,
			task: ITaskModel,
			callbacks: ToolCallbacks,
		): Promise<void>
		handlePartial?(this: Tool<TName> & Extras, task: ITaskModel, block: ToolUse<TName>): Promise<void>
	} & Extras,
): Tool<TName> & Extras {
	const tracker: PartialPathTracker = { lastSeenPartialPath: undefined }

	const tool = {
		...definition,

		handle: async (task: ITaskModel, block: ToolUse<TName>, callbacks: ToolCallbacks): Promise<void> => {
			if (block.partial) {
				if (tool.handlePartial) {
					await tool.handlePartial(task, block)
				}
				return
			}
			// `nativeArgs` is only populated by native/MCP tool calling. For
			// OpenAI-compatible (non-MCP) tool calls it is undefined, so fall back to
			// `params` (the parsed argument map).
			const params = (block.nativeArgs ?? block.params) as ToolParams<TName>
			await tool.execute(params, task, callbacks)
		},

		hasPathStabilized: (path: string | undefined): boolean => {
			const pathHasStabilized = tracker.lastSeenPartialPath !== undefined && tracker.lastSeenPartialPath === path
			tracker.lastSeenPartialPath = path
			return pathHasStabilized && !!path
		},

		resetPartialState: (): void => {
			tracker.lastSeenPartialPath = undefined
		},
	}

	return tool
}
