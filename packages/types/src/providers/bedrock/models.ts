import type { ModelInfo } from "../../models/model.ts"

import { bedrockModelsPart1 } from "./models-part1.ts"
import { bedrockModelsPart2 } from "./models-part2.ts"
import { bedrockModelsPart3 } from "./models-part3.ts"
import { bedrockModelsPart4 } from "./models-part4.ts"

export const bedrockModels = {
	...bedrockModelsPart1,
	...bedrockModelsPart2,
	...bedrockModelsPart3,
	...bedrockModelsPart4,
} as const satisfies Record<string, ModelInfo>
