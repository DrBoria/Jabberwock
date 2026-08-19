import type { ModelInfo } from "../../models/model.ts"

import { vertexModelsPart1 } from "./models-part1.ts"
import { vertexModelsPart2 } from "./models-part2.ts"
import { vertexModelsPart3 } from "./models-part3.ts"

export const vertexModels = {
	...vertexModelsPart1,
	...vertexModelsPart2,
	...vertexModelsPart3,
} as const satisfies Record<string, ModelInfo>
