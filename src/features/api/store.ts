import { types } from "mobx-state-tree"

/**
 * StreamingModel — tracks streaming state per task.
 * Migrated from actions/agent/store.ts.
 */
export const StreamingModel = types.model("Streaming", {
	taskId: types.string,
	isStreaming: types.boolean,
	isWaitingForFirstChunk: types.boolean,
	currentStreamingContentIndex: types.integer,
	currentStreamingDidCheckpoint: types.boolean,
	didCompleteReadingStream: types.boolean,
	assistantMessageSavedToHistory: types.boolean,
	didRejectTool: types.boolean,
	didAlreadyUseTool: types.boolean,
	didToolFailInCurrentTurn: types.boolean,
	streamingToolCallIndices: types.frozen<Record<string, number>>(),

	// Present assistant message state (closely tied to streaming)
	presentAssistantMessageLocked: types.boolean,
	presentAssistantMessageHasPendingUpdates: types.boolean,
	userMessageContentReady: types.boolean,
})

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Named MST model type alias
export interface IStreamingModel extends ReturnType<typeof StreamingModel.create> {}

/**
 * StreamingStoreModel — manages streaming state per task.
 * Migrated from actions/agent/store.ts.
 */
export const StreamingStoreModel = types
	.model("StreamingStore", {
		entries: types.map(StreamingModel),
	})
	.views((self) => ({
		getForTask(taskId: string): IStreamingModel | undefined {
			return self.entries.get(taskId)
		},
		hasForTask(taskId: string): boolean {
			return self.entries.has(taskId)
		},
	}))
	.actions((self) => ({
		getOrCreate(taskId: string): IStreamingModel {
			if (!self.entries.has(taskId)) {
				self.entries.put(
					StreamingModel.create({
						taskId,
						isStreaming: false,
						isWaitingForFirstChunk: false,
						currentStreamingContentIndex: 0,
						currentStreamingDidCheckpoint: false,
						didCompleteReadingStream: false,
						assistantMessageSavedToHistory: false,
						didRejectTool: false,
						didAlreadyUseTool: false,
						didToolFailInCurrentTurn: false,
						streamingToolCallIndices: {},
						presentAssistantMessageLocked: false,
						presentAssistantMessageHasPendingUpdates: false,
						userMessageContentReady: false,
					}),
				)
			}
			return self.entries.get(taskId)!
		},
	}))

/**
 * ApiModel — top-level MST model for the API feature.
 */
export const ApiModel = types.model("Api", {
	streaming: types.optional(StreamingStoreModel, () => StreamingStoreModel.create({})),
})

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Named MST model type alias
export interface IApiModel extends ReturnType<typeof ApiModel.create> {}
