import type { IHostEnvironment } from "@features/foundation/host-context/context"
import type { SecretState } from "@jabberwock/types"
import { EmbedderProvider } from "@services/code-index/interfaces/manager"
import type { PreviousConfigSnapshot } from "@services/code-index/interfaces/config"

type SecretStateKey = keyof SecretState

// Map of recognized provider names to normalized EmbedderProvider type
export const PROVIDER_MAP: Record<string, EmbedderProvider> = {
	ollama: "ollama",
	"openai-compatible": "openai-compatible",
	gemini: "gemini",
	mistral: "mistral",
	"vercel-ai-gateway": "vercel-ai-gateway",
	bedrock: "bedrock",
	openrouter: "openrouter",
}

export function resolveProvider(raw: string): EmbedderProvider {
	return PROVIDER_MAP[raw] ?? "openai"
}

export function validateModelDimension(raw: unknown): number | undefined {
	if (raw !== undefined && raw !== null) {
		const dimension = Number(raw)
		if (!isNaN(dimension) && dimension > 0) {
			return dimension
		}
		console.warn(
			`[jabberwock] Invalid codebaseIndexEmbedderModelDimension value: ${String(raw)}. Must be a positive number.`,
		)
	}
	return undefined
}

export function conditionValue<T>(condition: unknown, value: T): T | undefined {
	if (!condition) return undefined
	return value
}

export function strOrEmpty(val: string | undefined): string {
	if (val) return val
	return ""
}

export function strOrUndefined(val: string | undefined): string | undefined {
	if (val) return val
	return undefined
}

export function readGlobalConfig(contextProxy: IHostEnvironment | undefined): Record<string, unknown> | undefined {
	if (!contextProxy) return undefined
	return contextProxy.getGlobalState("codebaseIndexConfig") as Record<string, unknown> | undefined
}

export function readSecret(contextProxy: IHostEnvironment | undefined, key: SecretStateKey): string | undefined {
	if (!contextProxy) return undefined
	return contextProxy.getSecret(key)
}

export function optStr<T, K extends keyof T>(obj: T | undefined, key: K): string | undefined {
	if (!obj) return undefined
	const val = obj[key]
	return typeof val === "string" ? val : undefined
}

export function hasFieldChanged(pairs: readonly [unknown, unknown][]): boolean {
	return pairs.some(([a, b]) => a !== b)
}

export function getPrevStr(
	prev: PreviousConfigSnapshot | undefined,
	key: keyof PreviousConfigSnapshot,
): string | undefined {
	if (!prev) return undefined
	const val = prev[key]
	return typeof val === "string" ? val : undefined
}

export function getPrevBool(prev: PreviousConfigSnapshot | undefined, key: keyof PreviousConfigSnapshot): boolean {
	if (!prev) return false
	return Boolean(prev[key])
}

export function shouldForceRestart(
	prev: PreviousConfigSnapshot | undefined,
	enabled: boolean,
	configured: boolean,
): boolean {
	const prevEnabled = getPrevBool(prev, "enabled")
	const prevConfigured = getPrevBool(prev, "configured")
	if (prevEnabled || prevConfigured) return false
	if (!enabled) return false
	if (!configured) return false
	return true
}

export function shouldForceStop(prev: PreviousConfigSnapshot | undefined, enabled: boolean): boolean {
	const prevEnabled = getPrevBool(prev, "enabled")
	if (!prevEnabled) return false
	if (enabled) return false
	return true
}

export function shouldSkipRestart(
	prev: PreviousConfigSnapshot | undefined,
	enabled: boolean,
	configured: boolean,
): boolean {
	const prevEnabled = getPrevStr(prev, "enabled")
	const prevConfigured = getPrevStr(prev, "configured")
	if (prevEnabled) return false
	if (prevConfigured) return false
	if (enabled) return false
	if (configured) return false
	return true
}

export function hasProviderChanged(
	prev: PreviousConfigSnapshot | undefined,
	currentProvider: EmbedderProvider,
): boolean {
	const prevProvider = getPrevStr(prev, "embedderProvider")
	return prevProvider !== currentProvider
}
