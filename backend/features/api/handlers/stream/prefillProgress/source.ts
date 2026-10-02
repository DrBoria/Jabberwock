/**
 * Prefill progress sources — provider-agnostic interface + llama.cpp adapter.
 *
 * The common contract is deliberately tiny: a source can report the current
 * prefill (prompt-processing) progress as a 0-100 percentage, or `null` when
 * the provider does not expose that signal. Providers that cannot report a
 * percentage simply return `null` and the UI falls back to the indeterminate
 * "Loading context…" label.
 *
 * The llama.cpp adapter converts the llama.cpp server's `/slots` endpoint
 * (`n_prompt_tokens_processed` / `n_prompt_tokens`) into this common interface.
 * It is used for any local llama.cpp-compatible server (llama.cpp itself, LM
 * Studio, etc.). A 404 / network error degrades to `null`, so the same adapter
 * is safe to attach to servers that do not expose `/slots`.
 */

import type { ProviderSettings } from "@jabberwock/types"

/** A source that can report prefill progress as a percentage, or null. */
export interface IPrefillProgressSource {
	/**
	 * @returns the current prefill progress in the range 0-100, or `null` when
	 *          the provider does not expose a usable progress signal.
	 */
	getPercent(): Promise<number | null>
}

interface LlamaSlot {
	id?: number
	is_processing?: boolean
	n_prompt_tokens?: number
	n_prompt_tokens_processed?: number
	n_prompt_tokens_cache?: number
}

/**
 * llama.cpp adapter — reads prefill progress from the server's `/slots`
 * endpoint.
 *
 * Progress = fraction of the prompt already *handled*, i.e. either computed
 * (`n_prompt_tokens_processed`) or served from the KV cache
 * (`n_prompt_tokens_cache`), divided by the total prompt tokens
 * (`n_prompt_tokens`):
 *
 *   percent = (done + cached) / total
 *
 * This is the semantically correct "loading context" measure and it is
 * monotonic in both cache regimes:
 *   - **Cold** (first request, `cached = 0`): reduces to `done / total`,
 *     which rises 0→100% over the long prefill.
 *   - **Warm** (multi-turn, most tokens cached): the bar sits near 100% —
 *     accurate, because the context is already loaded and only a handful of
 *     new tokens need computing.
 *
 * The naive `done / total` is wrong for the warm case: the cache serves the
 * bulk of the prompt instantly, so `done` only counts the few uncached tokens
 * and the percentage stays pinned at ~0%.
 */
function computeLlamaPercent(slots: LlamaSlot[]): number | null {
	if (!Array.isArray(slots) || slots.length === 0) return null
	const active = slots.find((s) => s.is_processing) ?? slots[0]
	const total = active.n_prompt_tokens ?? 0
	const done = active.n_prompt_tokens_processed ?? 0
	const cached = active.n_prompt_tokens_cache ?? 0
	if (total <= 0) return null
	const pct = Math.round(((done + cached) / total) * 100)
	return Math.max(0, Math.min(100, pct))
}

/**
 * Create the llama.cpp adapter — reads prefill progress from the server's
 * `/slots` endpoint.
 */
export function createLlamaCppPrefillSource(baseUrl: string): IPrefillProgressSource {
	return {
		async getPercent(): Promise<number | null> {
			try {
				const res = await fetch(`${baseUrl}/slots`, { signal: AbortSignal.timeout(2000) })
				if (!res.ok) return null
				const slots = (await res.json()) as LlamaSlot[]
				return computeLlamaPercent(slots)
			} catch {
				return null
			}
		},
	}
}

/**
 * Resolve the local llama.cpp-compatible base URL from the provider config,
 * stripping a trailing `/v1`. Returns `null` when the provider does not use a
 * base URL we can probe.
 */
function resolveLocalBaseUrl(config: ProviderSettings): string | null {
	let base: string | undefined
	switch (config.apiProvider) {
		case "lmstudio":
			base = config.lmStudioBaseUrl
			break
		case "openai":
			base = config.openAiBaseUrl
			break
		case "deepseek":
			base = config.deepSeekBaseUrl
			break
		case "ollama":
			base = config.ollamaBaseUrl
			break
		default:
			return null
	}
	if (!base) return null
	let url = base.trim().replace(/\/+$/, "")
	url = url.replace(/\/v1$/i, "")
	return url || null
}

/** Only probe local servers — never hammer a remote API with `/slots`. */
function isLocalBaseUrl(url: string): boolean {
	try {
		const host = new URL(url).hostname
		return (
			host === "localhost" ||
			host === "127.0.0.1" ||
			host === "0.0.0.0" ||
			host === "::1" ||
			host.endsWith(".local")
		)
	} catch {
		return false
	}
}

/**
 * Build a prefill progress source for the given provider config, or `null`
 * when the provider cannot report prefill progress (remote APIs, providers
 * without a `/slots` endpoint, etc.).
 */
export function createPrefillProgressSource(config: ProviderSettings): IPrefillProgressSource | null {
	const base = resolveLocalBaseUrl(config)
	if (!base || !isLocalBaseUrl(base)) return null
	return createLlamaCppPrefillSource(base)
}
