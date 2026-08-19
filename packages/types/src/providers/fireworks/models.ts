import type { ModelInfo } from "../../models/model.ts"

import { fireworksModelsPart1 } from "./models-part1.ts"
import { fireworksModelsPart2 } from "./models-part2.ts"

export const fireworksModels = {
	...fireworksModelsPart1,
	...fireworksModelsPart2,
} as const satisfies Record<string, ModelInfo>
