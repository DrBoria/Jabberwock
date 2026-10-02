import { describe, expect, it } from "vitest"

import { normalizeCompletionText } from "./completion-text"

describe("normalizeCompletionText", () => {
	it("returns plain text unchanged", () => {
		expect(normalizeCompletionText("PONG-42")).toBe("PONG-42")
		expect(normalizeCompletionText("All done, 3 files changed.")).toBe("All done, 3 files changed.")
	})

	it("unwraps a JSON envelope with a result key", () => {
		expect(normalizeCompletionText('{"result":"PONG-42"}')).toBe("PONG-42")
	})

	it("unwraps a JSON envelope with other common keys", () => {
		expect(normalizeCompletionText('{"answer":"done"}')).toBe("done")
		expect(normalizeCompletionText('{"output":"ok"}')).toBe("ok")
		expect(normalizeCompletionText('{"message":"ok"}')).toBe("ok")
	})

	it("keeps JSON objects that have no known result key", () => {
		expect(normalizeCompletionText('{"foo":1}')).toBe('{"foo":1}')
	})

	it("keeps JSON arrays as-is", () => {
		expect(normalizeCompletionText('["a","b"]')).toBe('["a","b"]')
	})

	it("unwraps a markdown code fence", () => {
		expect(normalizeCompletionText("```\nPONG-42\n```")).toBe("PONG-42")
		expect(normalizeCompletionText("```text\nhello world\n```")).toBe("hello world")
	})

	it("unwraps a fenced JSON envelope", () => {
		expect(normalizeCompletionText('```\n{"result":"PONG-42"}\n```')).toBe("PONG-42")
	})

	it("trims surrounding whitespace", () => {
		expect(normalizeCompletionText("  PONG-42  ")).toBe("PONG-42")
	})

	it("handles empty and undefined-ish input", () => {
		expect(normalizeCompletionText("")).toBe("")
		expect(normalizeCompletionText("   ")).toBe("")
	})

	it("does not crash on malformed JSON", () => {
		expect(normalizeCompletionText("{not json")).toBe("{not json")
	})
})
