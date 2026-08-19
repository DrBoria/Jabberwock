import { z } from "zod"

/**
 * DynamicProvider
 *
 * Dynamic provider requires external API calls in order to get the model list.
 */

export const dynamicProviders = [
	"openrouter",
	"vercel-ai-gateway",
	"litellm",
	"requesty",
	"jabberwock",
	"unbound",
] as const

/**
 * Type guard to check if a provider name is a dynamic provider.
 */
export const isDynamicProvider = (key: string): key is DynamicProvider =>
	key === "openrouter" ||
	key === "vercel-ai-gateway" ||
	key === "litellm" ||
	key === "requesty" ||
	key === "jabberwock" ||
	key === "unbound"

export type DynamicProvider = (typeof dynamicProviders)[number]

/**
 * LocalProvider
 *
 * Local providers require localhost API calls in order to get the model list.
 */

export const localProviders = ["ollama", "lmstudio"] as const

/**
 * Type guard to check if a provider name is a local provider.
 */
export const isLocalProvider = (key: string): key is LocalProvider => key === "ollama" || key === "lmstudio"

export type LocalProvider = (typeof localProviders)[number]

/**
 * InternalProvider
 *
 * Internal providers require internal VSCode API calls in order to get the
 * model list.
 */

export const internalProviders = ["vscode-lm"] as const

export type InternalProvider = (typeof internalProviders)[number]

/**
 * CustomProvider
 *
 * Custom providers are completely configurable within Jabberwock settings.
 */

export const customProviders = ["openai"] as const

/**
 * Type guard to check if a provider name is a custom provider.
 */
export const isCustomProvider = (key: string): key is CustomProvider => key === "openai"

export type CustomProvider = (typeof customProviders)[number]

/**
 * FauxProvider
 *
 * Faux providers do not make external inference calls and therefore do not have
 * model lists.
 */

export const fauxProviders = ["fake-ai"] as const

/**
 * Type guard to check if a provider name is a faux provider.
 */
export const isFauxProvider = (key: string): key is FauxProvider => key === "fake-ai"

export type FauxProvider = (typeof fauxProviders)[number]

/**
 * ProviderName
 */

export const providerNames = [
	...dynamicProviders,
	...localProviders,
	...internalProviders,
	...customProviders,
	...fauxProviders,
	"anthropic",
	"bedrock",
	"baseten",
	"deepseek",
	"fireworks",
	"gemini",
	"gemini-cli",
	"mistral",
	"moonshot",
	"minimax",
	"openai-codex",
	"openai-native",
	"qwen-code",
	"jabberwock",
	"sambanova",
	"vertex",
	"xai",
	"zai",
] as const

export const providerNamesSchema = z.enum(providerNames)

export type ProviderName = z.infer<typeof providerNamesSchema>

export const isProviderName = (key: unknown): key is ProviderName =>
	typeof key === "string" && providerNames.includes(key as ProviderName)

/**
 * RetiredProviderName
 */

export const retiredProviderNames = [
	"cerebras",
	"chutes",
	"deepinfra",
	"doubao",
	"featherless",
	"groq",
	"huggingface",
	"io-intelligence",
] as const

/**
 * Type guard to check if a provider name is a retired provider.
 */
export const isRetiredProvider = (key: string): key is RetiredProviderName =>
	key === "cerebras" ||
	key === "chutes" ||
	key === "deepinfra" ||
	key === "doubao" ||
	key === "featherless" ||
	key === "groq" ||
	key === "huggingface" ||
	key === "io-intelligence"

export const retiredProviderNamesSchema = z.enum(retiredProviderNames)

export type RetiredProviderName = z.infer<typeof retiredProviderNamesSchema>

export const providerNamesWithRetiredSchema = z.union([providerNamesSchema, retiredProviderNamesSchema])

export type ProviderNameWithRetired = z.infer<typeof providerNamesWithRetiredSchema>

/**
 * TypicalProvider
 */

export type TypicalProvider = Exclude<ProviderName, InternalProvider | CustomProvider | FauxProvider>

export const isTypicalProvider = (key: unknown): key is TypicalProvider =>
	isProviderName(key) &&
	!internalProviders.includes(key as InternalProvider) &&
	!customProviders.includes(key as CustomProvider) &&
	!fauxProviders.includes(key as FauxProvider)

/**
 * Constants
 */

export const DEFAULT_CONSECUTIVE_MISTAKE_LIMIT = 3
