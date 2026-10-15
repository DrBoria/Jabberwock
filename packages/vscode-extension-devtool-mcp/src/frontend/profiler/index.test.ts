import { describe, expect, it } from "vitest"
import { MetricsCollector, type RequestMetrics } from "./index.js"

function sample(op: string, durationMs: number, ok = true, error?: string): RequestMetrics {
	return {
		operation: op,
		durationMs,
		startedAt: 0,
		timestamp: Date.now(),
		ok,
		error,
	}
}

describe("MetricsCollector", () => {
	it("records a sample via track() and resolves with it", async () => {
		const m = new MetricsCollector()
		const sample = await m.track("op", async () => "value")
		expect(sample.operation).toBe("op")
		expect(sample.ok).toBe(true)
		expect(m.size).toBe(1)
		expect(m.list()[0]).toBe(sample)
	})

	it("records a failed sample and rethrows the original error", async () => {
		const m = new MetricsCollector()
		await expect(
			m.track("boom", async () => {
				throw new Error("kaboom")
			}),
		).rejects.toThrow("kaboom")
		expect(m.size).toBe(1)
		const s = m.list()[0]
		expect(s?.ok).toBe(false)
		expect(s?.error).toBe("kaboom")
	})

	it("records a failed sample for non-Error throws (wrapped in an Error)", async () => {
		const m = new MetricsCollector()
		await expect(
			m.track("boom", async () => {
				throw "string-failure"
			}),
		).rejects.toThrow("string-failure")
		expect(m.list()[0]?.error).toBe("string-failure")
	})

	it("caps the ring buffer at capacity", () => {
		const m = new MetricsCollector(3)
		for (let i = 0; i < 5; i++) m.record(sample(`op${i}`, i))
		expect(m.size).toBe(3)
		// Oldest two (op0, op1) dropped; newest three retained.
		expect(m.list().map((s) => s.operation)).toEqual(["op2", "op3", "op4"])
	})

	it("coerces capacity below 1 to 1", () => {
		const m = new MetricsCollector(0)
		m.record(sample("a", 1))
		m.record(sample("b", 2))
		expect(m.size).toBe(1)
	})

	it("tail() returns the newest samples first", () => {
		const m = new MetricsCollector()
		for (let i = 0; i < 5; i++) m.record(sample(`op${i}`, i))
		expect(m.tail(3).map((s) => s.operation)).toEqual(["op4", "op3", "op2"])
	})

	it("clear() empties the buffer", () => {
		const m = new MetricsCollector()
		m.record(sample("a", 1))
		m.clear()
		expect(m.size).toBe(0)
	})

	it("builds a histogram with an unbounded final bucket", () => {
		const m = new MetricsCollector(100, [10, 100])
		m.record(sample("a", 5))
		m.record(sample("b", 50))
		m.record(sample("c", 5000))
		const buckets = m.histogram()
		expect(buckets).toHaveLength(3) // 10, 100, Infinity
		expect(buckets[0]?.count).toBe(1) // <= 10
		expect(buckets[1]?.count).toBe(1) // <= 100
		expect(buckets[2]?.count).toBe(1) // unbounded
	})

	it("summary() reports count, min/max, avg, percentiles and error rate", () => {
		const m = new MetricsCollector()
		m.record(sample("a", 10))
		m.record(sample("b", 20))
		m.record(sample("c", 30))
		m.record(sample("d", 40, false, "err"))
		const s = m.summary()
		expect(s.count).toBe(4)
		expect(s.minMs).toBe(10)
		expect(s.maxMs).toBe(40)
		expect(s.avgMs).toBe(25)
		expect(s.errorRate).toBeCloseTo(0.25)
	})

	it("summary() on an empty buffer is all zeros", () => {
		const s = new MetricsCollector().summary()
		expect(s.count).toBe(0)
		expect(s.minMs).toBe(0)
		expect(s.maxMs).toBe(0)
		expect(s.avgMs).toBe(0)
		expect(s.errorRate).toBe(0)
	})

	it("captures a memory sample in the recorded metrics", async () => {
		const m = new MetricsCollector()
		await m.track("mem", async () => undefined)
		expect(m.list()[0]?.memory).toBeDefined()
	})
})
