import { ZaiApiLine } from "../../settings/provider/schemas.ts"

// Z AI
// https://docs.z.ai/guides/llm/glm-4-32b-0414-128k
// https://docs.z.ai/guides/llm/glm-4.5
// https://docs.z.ai/guides/llm/glm-4.6
// https://docs.z.ai/guides/overview/pricing
// https://bigmodel.cn/pricing

import { internationalZAiModels } from "./models-international.ts"
import { mainlandZAiModels } from "./models-mainland.ts"

export type InternationalZAiModelId = keyof typeof internationalZAiModels
export const internationalZAiDefaultModelId: InternationalZAiModelId = "glm-4.6"
export { internationalZAiModels }

export type MainlandZAiModelId = keyof typeof mainlandZAiModels
export const mainlandZAiDefaultModelId: MainlandZAiModelId = "glm-4.6"
export { mainlandZAiModels }

export const ZAI_DEFAULT_TEMPERATURE = 0.6

export const zaiApiLineConfigs = {
	international_coding: {
		name: "International Coding",
		baseUrl: "https://api.z.ai/api/coding/paas/v4",
		isChina: false,
	},
	china_coding: {
		name: "China Coding",
		baseUrl: "https://open.bigmodel.cn/api/coding/paas/v4",
		isChina: true,
	},
	international_api: {
		name: "International API",
		baseUrl: "https://api.z.ai/api/paas/v4",
		isChina: false,
	},
	china_api: {
		name: "China API",
		baseUrl: "https://open.bigmodel.cn/api/paas/v4",
		isChina: true,
	},
} satisfies Record<ZaiApiLine, { name: string; baseUrl: string; isChina: boolean }>
