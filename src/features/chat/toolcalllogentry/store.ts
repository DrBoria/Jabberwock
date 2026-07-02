import { types } from "mobx-state-tree"

export const ToolCallLogEntry = types.model("ToolCallLogEntry", {
	toolName: types.string,
	args: types.string,
	timestamp: types.number,
	status: types.enumeration(["started", "completed", "error"]),
	result: types.maybe(types.string),
	error: types.maybe(types.string),
})
