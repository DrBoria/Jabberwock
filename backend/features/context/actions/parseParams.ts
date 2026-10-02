// Protocol parameter extraction for context intent request builders [D-frames-values-nesting]. WebviewMessage is a closed interface, so host-built messages nest structured params under values while WS wire bodies carry them as flat top-level fields (v4 section 6.2 "no shape divergence"); every reader below checks the flat form first and falls back to values nesting.

import type { WebviewMessage } from "@jabberwock/types"

/** Read a protocol param that may ride either as a flat top-level field on the wire body or under values nesting [D-frames-values-nesting]. WebviewMessage is a closed interface, so undeclared keys are read through an explicit record view of the same object (spread - no cast). */
function flatParam(message: WebviewMessage, key: string): unknown {
	const record: Record<string, unknown> = { ...message } // runtime superset of the closed interface.
	return record[key]
}

export function valueString(message: WebviewMessage, key: string): string | undefined {
	const top = flatParam(message, key) // Flat wire shape first - WS envelope bodies carry protocol params as top-level fields (v4 section 6.2 "no shape divergence").
	if (typeof top === "string" && top.length > 0) return top
	const value = message.values?.[key]
	return typeof value === "string" ? value : undefined // Host-constructed messages nest structured params under values [D-frames-values-nesting].
}

export function valueNumber(message: WebviewMessage, key: string): number | undefined {
	const top = flatParam(message, key) // Flat wire shape first (v4 section 6.2); host messages nest under values [D-frames-values-nesting].
	if (typeof top === "number" && Number.isFinite(top)) return Math.floor(top)
	const value = message.values?.[key]
	if (typeof value !== "number" || !Number.isFinite(value)) return undefined
	return Math.floor(value)
}

export function valueArrayStrings(message: WebviewMessage, key: string): string[] | undefined {
	const top = flatParam(message, key) // Flat wire shape first (v4 section 6.2); host messages nest under values [D-frames-values-nesting].
	const raw = Array.isArray(top) && top.length > 0 ? top : message.values?.[key]
	if (!Array.isArray(raw)) return undefined
	const out: string[] = []
	for (const element of raw) if (typeof element === "string") out.push(element)
	return out.length > 0 ? out : undefined
}
