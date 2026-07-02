import { types } from "mobx-state-tree"

export const StreamingToolCallModel = types.model("StreamingToolCall", {
	id: types.string,
	name: types.string,
	argumentsAccumulator: types.string,
})
