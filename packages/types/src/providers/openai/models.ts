import type { ModelInfo } from "../../models/model.ts"

import { openAiNativeModelsPart1 } from "./models-part1.ts"
import { openAiNativeModelsPart2 } from "./models-part2.ts"
import { openAiNativeModelsPart3 } from "./models-part3.ts"
import { openAiNativeModelsPart4 } from "./models-part4.ts"

export const openAiNativeModels = {
	...openAiNativeModelsPart1,
	...openAiNativeModelsPart2,
	...openAiNativeModelsPart3,
	...openAiNativeModelsPart4,
} as const satisfies Record<string, ModelInfo>
