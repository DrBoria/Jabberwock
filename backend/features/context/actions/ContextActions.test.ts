import { contextEventNames } from "@jabberwock/types"
import { describe, expect, it } from "vitest"

import contextRecallToolDef from "@features/settings/context/tools/native-tools/context/context_recall"
import contextSearchToolDef from "@features/settings/context/tools/native-tools/context/context_search"
import { filterNativeToolsForMode } from "@features/settings/context/tools/filter-tools-for-mode"
import { INTENT_PRIORITY } from "@features/context/intents/IntentConstants"
import {
	buildFtsMatchExpression,
	clampSearchLimit,
	resolveRecallBudget,
} from "@features/context/services/ContextSearchService"

// G4 gating fixture - both native context tool definitions exactly as buildToolDefinitions would receive them.
const CONTEXT_TOOL_DEFS = [contextSearchToolDef, contextRecallToolDef]

// ICG-C2 unit suite (registration + helpers + gating subset): section 8.1 priority buckets (backend side), token budgeting + FTS expression helpers, and G4 default-OFF gating for the native context tools. The archive read-path and chunked-delivery acceptance cases live in the sibling ContextActions.search.test.ts / ContextActions.delivery.test.ts specs [D-actions-test-split].

describe("ICG-C2 section 8.1 intent registration table", () => {
	it("pins all ten context constants to their intended Fiber IntentBus buckets (v4 ch5: Critical=0 High=1 Normal=2 Low=3)", () => {
		const expected: Array<[string, number]> = [
			[contextEventNames.compressRequested, 3], // Low - background compression work.
			[contextEventNames.compressCompleted, 2], // Normal broadcast (section 7.2).
			[contextEventNames.recallRequested, 1], // High - the model waits on the tool result in the turn-critical path.
			[contextEventNames.searchRequested, 1], // High - same class as tool.execution.required.
			[contextEventNames.describeRequested, 1], // High - same class as tool.execution.required.
			[contextEventNames.windowEvicted, 3], // Low.
			[contextEventNames.historyRangeRequested, 2], // Normal [ICG-C2 new].
			[contextEventNames.nodeUpdatedBroadcast, 2], // Normal broadcast (section 7.2).
			[contextEventNames.windowManifestChanged, 2], // Normal broadcast (section 7.2).
			[contextEventNames.compressProgress, 3], // Low - progress chatter must not preempt tool traffic.
		]

		for (const [name, bucket] of expected) {
			expect(INTENT_PRIORITY[name]).toBe(bucket)
		}
	})

	it("keeps the response frames off the intent table (backend-to-frontend only - they never ride the IntentBus)", () => {
		expect(INTENT_PRIORITY[contextEventNames.searchResponse]).toBeUndefined()
		expect(INTENT_PRIORITY[contextEventNames.recallResponse]).toBeUndefined()
		expect(INTENT_PRIORITY[contextEventNames.describeResponse]).toBeUndefined()
		expect(INTENT_PRIORITY[contextEventNames.historyCancelled]).toBeUndefined()
	})
})

describe("token budgeting and FTS expression helpers", () => {
	it("resolveRecallBudget defaults to 8000 tokens when no window is supplied (C2 has no live window source)", () => {
		expect(resolveRecallBudget()).toBe(8000)
	})

	it("resolveRecallBudget passes an explicit maxTokens through unchanged without a window", () => {
		expect(resolveRecallBudget(1234)).toBe(1234)
	})

	it("resolveRecallBudget clamps to the remaining window (window - assembly - reserved, floor 1)", () => {
		expect(resolveRecallBudget(8000, 16000, 9500, 200)).toBe(6300) // requested exceeds what fits.
		expect(resolveRecallBudget(100, 16000, 9500, 200)).toBe(100) // request already fits - unchanged.
		expect(resolveRecallBudget(8000, 4000, 3999, 0)).toBe(1) // exhausted window floors at one token.
	})

	it("buildFtsMatchExpression quotes each term and joins with OR (unicode61-safe single tokens)", () => {
		expect(buildFtsMatchExpression("alpha beta")).toBe('"alpha" OR "beta"')
		expect(buildFtsMatchExpression("solo")).toBe('"solo"')
	})

	it("buildFtsMatchExpression returns null when no usable term remains", () => {
		expect(buildFtsMatchExpression("   ")).toBeNull()
		expect(buildFtsMatchExpression("")).toBeNull()
	})

	it("clampSearchLimit clamps into 1..50 with the default for absent input", () => {
		expect(clampSearchLimit()).toBe(10) // DEFAULT_SEARCH_LIMIT.
		expect(clampSearchLimit(3)).toBe(3)
		expect(clampSearchLimit(-4)).toBe(1)
		expect(clampSearchLimit(999)).toBe(50) // MAX_SEARCH_LIMIT.
	})
})

describe("native context tools behind contextGraphTools (G4 default OFF)", () => {
	it("tool definitions carry stable function names for model-side addressing", () => {
		expect(contextSearchToolDef.function.name).toBe("context_search") // satisfies keeps the concrete literal type - direct access is cast-free.
		expect(contextRecallToolDef.function.name).toBe("context_recall")
	})

	it("excludes both context tools when the experiment is absent (fresh state - DEFAULT OFF until ICG-F sign-off)", () => {
		const visible = filterNativeToolsForMode(CONTEXT_TOOL_DEFS, undefined, [], {}) // fresh experiments {} -> excludeToolIfExperimentDisabled drops both [flag: contextGraphTools].
		expect(visible).toEqual([])
	})

	it("includes both context tools when the experiment flag is enabled", () => {
		const visible = filterNativeToolsForMode(CONTEXT_TOOL_DEFS, undefined, [], { contextGraphTools: true })
		expect(JSON.stringify(visible)).toContain('"context_search"') // JSON comparison keeps this cast-free across the ChatCompletionTool union.
		expect(JSON.stringify(visible)).toContain('"context_recall"')
	})
})
