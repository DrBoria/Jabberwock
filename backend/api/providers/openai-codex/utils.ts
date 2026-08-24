import * as os from "os"

import { Package } from "@shared/package"

import type { StreamState } from "./types"

export function isObjectSchema(schema: Record<string, unknown>): boolean {
	return !!schema && typeof schema === "object" && schema.type === "object"
}

export function isArrayOfObjects(prop: Record<string, unknown>): boolean {
	return prop?.type === "array" && (prop.items as Record<string, unknown> | undefined)?.type === "object"
}

export function shouldRecurseProp(prop: Record<string, unknown>): boolean {
	return prop?.type === "object" || isArrayOfObjects(prop)
}

export function ensureAllRequired(schema: Record<string, unknown>): Record<string, unknown> {
	if (!isObjectSchema(schema)) {
		return schema
	}
	const result = { ...schema }
	if (result.additionalProperties !== false) {
		result.additionalProperties = false
	}
	if (!result.properties) {
		return result
	}
	const allKeys = Object.keys(result.properties)
	result.required = allKeys
	const newProps: Record<string, unknown> = { ...result.properties }
	for (const key of allKeys) {
		const prop = newProps[key] as Record<string, unknown> | undefined
		if (!prop || !shouldRecurseProp(prop)) {
			continue
		}
		newProps[key] = ensureAllRequired(prop)
	}
	result.properties = newProps
	return result
}

export function ensureAdditionalPropertiesFalse(schema: Record<string, unknown>): Record<string, unknown> {
	if (!isObjectSchema(schema)) {
		return schema
	}
	const result = { ...schema }
	if (result.additionalProperties !== false) {
		result.additionalProperties = false
	}
	if (!result.properties) {
		return result
	}
	const newProps: Record<string, unknown> = { ...result.properties }
	for (const key of Object.keys(result.properties)) {
		const prop = newProps[key] as Record<string, unknown> | undefined
		if (!prop || !shouldRecurseProp(prop)) {
			continue
		}
		newProps[key] = ensureAdditionalPropertiesFalse(prop)
	}
	result.properties = newProps
	return result
}

export function getExtractedUsageToken(usage: Record<string, unknown>, ...keys: string[]): number {
	for (const key of keys) {
		const val = usage[key]
		if (typeof val === "number") {
			return val
		}
	}
	return 0
}

export function getExtractedString(v: unknown): string | undefined {
	if (typeof v === "string") return v
	return undefined
}

export function buildCodexHeaders(taskId?: string, sessionId?: string, accountId?: string): Record<string, string> {
	const headers: Record<string, string> = {
		originator: "jabberwock",
		session_id: taskId || sessionId || "",
		"User-Agent": `jabberwock/${Package.version} (${os.platform()} ${os.release()}; ${os.arch()}) node/${process.version.slice(1)}`,
	}
	if (accountId) {
		headers["ChatGPT-Account-Id"] = accountId
	}
	return headers
}

export function throwAuthError(): never {
	throw new Error("Not authenticated with OpenAI Codex. Please sign in using the OpenAI Codex OAuth flow.")
}

export function getNumberProp(obj: Record<string, unknown> | undefined, key: string): number {
	if (!obj) return 0
	const val = obj[key]
	return typeof val === "number" ? (val as number) : 0
}

export function extractTextFromEvent(event: Record<string, unknown>): string | undefined {
	if (typeof event.text === "string") return event.text as string
	if (typeof event.output_text === "string") return event.output_text as string
	if (typeof event.delta === "string") return event.delta as string
	return undefined
}

export function extractPartText(
	part: { type?: string; text?: string | { value?: string } } | undefined,
): string | undefined {
	if (!part) return undefined
	if (typeof part.text === "string") return part.text
	if (typeof (part.text as { value?: string } | undefined)?.value === "string") {
		return (part.text as { value: string }).value
	}
	return undefined
}

export function isItemEventType(type: string): boolean {
	return type === "response.output_item.added" || type === "response.output_item.done"
}

export function resolveToolCallId(item: Record<string, unknown>): unknown {
	return item.call_id ?? item.tool_call_id ?? item.id
}

export function trackToolCallFromItem(item: Record<string, unknown>, state: StreamState): void {
	const isToolItem = item.type === "function_call" || item.type === "tool_call"
	if (!isToolItem) return
	const callId = resolveToolCallId(item)
	if (typeof callId !== "string" || (callId as string).length === 0) return
	state.pendingToolCallId = callId as string
	const fn = item.function as Record<string, unknown> | undefined
	const name = (item.name ?? fn?.name ?? item.function_name) as string | undefined
	state.pendingToolCallName = typeof name === "string" ? name : undefined
}

export async function* noopGenerator(): AsyncGenerator<never> {
	// no-op
}
