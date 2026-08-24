import { types } from "mobx-state-tree"
import { StreamingModel, StreamingStoreModel } from "./streamingstore/store"
import type { IStreamingModel } from "./streamingstore/store"

/**
 * ApiModel — top-level MST model for the API feature.
 */
export const ApiModel = types.model("Api", {
	streaming: types.optional(StreamingStoreModel, () => StreamingStoreModel.create({})),
})

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Named MST model type alias
export interface IApiModel extends ReturnType<typeof ApiModel.create> {}

export { StreamingModel, StreamingStoreModel }
export type { IStreamingModel }
