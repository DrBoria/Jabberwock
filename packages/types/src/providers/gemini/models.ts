import type { ModelInfo } from "../../models/model.ts"

import { geminiModelsPart1 } from "./models-part1.ts"
import { geminiModelsPart2 } from "./models-part2.ts"

export const geminiModels = {
	...geminiModelsPart1,
	...geminiModelsPart2,
} as const satisfies Record<string, ModelInfo>
