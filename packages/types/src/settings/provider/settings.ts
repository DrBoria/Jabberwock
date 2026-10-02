import { z } from "zod"

import {
	anthropicSchema,
	openRouterSchema,
	bedrockSchema,
	vertexSchema,
	openAiSchema,
	ollamaSchema,
	vsCodeLmSchema,
	lmStudioSchema,
	geminiSchema,
	geminiCliSchema,
	openAiCodexSchema,
	openAiNativeSchema,
	mistralSchema,
	deepSeekSchema,
	moonshotSchema,
	minimaxSchema,
	requestySchema,
	unboundSchema,
	fakeAiSchema,
	xaiSchema,
	basetenSchema,
	litellmSchema,
	sambaNovaSchema,
	zaiSchema,
	fireworksSchema,
	qwenCodeSchema,
	jabberwockSchema,
	vercelAiGatewaySchema,
	defaultSchema,
} from "./schemas.ts"
import { codebaseIndexProviderSchema } from "../../execution/codebase-index.ts"
import { providerNamesWithRetiredSchema } from "./categories.ts"

/**
 * Combined schemas
 */

export const providerSettingsSchemaDiscriminated = z.discriminatedUnion("apiProvider", [
	anthropicSchema.merge(z.object({ apiProvider: z.literal("anthropic") })),
	openRouterSchema.merge(z.object({ apiProvider: z.literal("openrouter") })),
	bedrockSchema.merge(z.object({ apiProvider: z.literal("bedrock") })),
	vertexSchema.merge(z.object({ apiProvider: z.literal("vertex") })),
	openAiSchema.merge(z.object({ apiProvider: z.literal("openai") })),
	ollamaSchema.merge(z.object({ apiProvider: z.literal("ollama") })),
	vsCodeLmSchema.merge(z.object({ apiProvider: z.literal("vscode-lm") })),
	lmStudioSchema.merge(z.object({ apiProvider: z.literal("lmstudio") })),
	geminiSchema.merge(z.object({ apiProvider: z.literal("gemini") })),
	geminiCliSchema.merge(z.object({ apiProvider: z.literal("gemini-cli") })),
	openAiCodexSchema.merge(z.object({ apiProvider: z.literal("openai-codex") })),
	openAiNativeSchema.merge(z.object({ apiProvider: z.literal("openai-native") })),
	mistralSchema.merge(z.object({ apiProvider: z.literal("mistral") })),
	deepSeekSchema.merge(z.object({ apiProvider: z.literal("deepseek") })),
	moonshotSchema.merge(z.object({ apiProvider: z.literal("moonshot") })),
	minimaxSchema.merge(z.object({ apiProvider: z.literal("minimax") })),
	requestySchema.merge(z.object({ apiProvider: z.literal("requesty") })),
	unboundSchema.merge(z.object({ apiProvider: z.literal("unbound") })),
	fakeAiSchema.merge(z.object({ apiProvider: z.literal("fake-ai") })),
	xaiSchema.merge(z.object({ apiProvider: z.literal("xai") })),
	basetenSchema.merge(z.object({ apiProvider: z.literal("baseten") })),
	litellmSchema.merge(z.object({ apiProvider: z.literal("litellm") })),
	sambaNovaSchema.merge(z.object({ apiProvider: z.literal("sambanova") })),
	zaiSchema.merge(z.object({ apiProvider: z.literal("zai") })),
	fireworksSchema.merge(z.object({ apiProvider: z.literal("fireworks") })),
	qwenCodeSchema.merge(z.object({ apiProvider: z.literal("qwen-code") })),
	jabberwockSchema.merge(z.object({ apiProvider: z.literal("jabberwock") })),
	vercelAiGatewaySchema.merge(z.object({ apiProvider: z.literal("vercel-ai-gateway") })),
	defaultSchema,
])

export const providerSettingsSchema = z.object({
	apiProvider: providerNamesWithRetiredSchema.optional(),
	...anthropicSchema.shape,
	...openRouterSchema.shape,
	...bedrockSchema.shape,
	...vertexSchema.shape,
	...openAiSchema.shape,
	...ollamaSchema.shape,
	...vsCodeLmSchema.shape,
	...lmStudioSchema.shape,
	...geminiSchema.shape,
	...geminiCliSchema.shape,
	...openAiCodexSchema.shape,
	...openAiNativeSchema.shape,
	...mistralSchema.shape,
	...deepSeekSchema.shape,
	...moonshotSchema.shape,
	...minimaxSchema.shape,
	...requestySchema.shape,
	...unboundSchema.shape,
	...fakeAiSchema.shape,
	...xaiSchema.shape,
	...basetenSchema.shape,
	...litellmSchema.shape,
	...sambaNovaSchema.shape,
	...zaiSchema.shape,
	...fireworksSchema.shape,
	...qwenCodeSchema.shape,
	...jabberwockSchema.shape,
	...vercelAiGatewaySchema.shape,
	...codebaseIndexProviderSchema.shape,
})

export type ProviderSettings = z.infer<typeof providerSettingsSchema>

export const providerSettingsWithIdSchema = providerSettingsSchema.extend({ id: z.string().optional() })

export const discriminatedProviderSettingsWithIdSchema = providerSettingsSchemaDiscriminated.and(
	z.object({ id: z.string().optional() }),
)

export type ProviderSettingsWithId = z.infer<typeof providerSettingsWithIdSchema>

export const PROVIDER_SETTINGS_KEYS = providerSettingsSchema.keyof().options
