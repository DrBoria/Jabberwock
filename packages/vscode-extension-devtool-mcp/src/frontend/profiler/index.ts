/**
 * Per-devtool-request performance profiling.
 *
 * A {@link MetricsCollector} records one {@link RequestMetrics} sample per
 * devtool request (an MCP tool call, a DOM action, a store query, …). Each
 * sample captures wall-clock duration, an optional CPU delta, and an optional
 * memory snapshot. Samples are kept in a bounded ring buffer and can be
 * aggregated into a latency histogram for "maximum profiling" dashboards.
 *
 * The collector is environment-agnostic: in a browser webview it uses
 * `performance.now()` / `performance.memory`; in a Node backend it falls back
 * to `process.memoryUsage()` / `process.cpuUsage()`. It never throws — when a
 * resource API is unavailable the corresponding fields are simply omitted.
 */
import {
	DEFAULT_BUCKET_EDGES,
	cpuDeltaMs,
	getNow,
	readCpu,
	readMemory,
	type HistogramBucket,
	type RequestMetrics,
} from "./types.js"

// Re-export the metric shapes so consumers keep a single import point.
export type { HistogramBucket, MemorySample, RequestMetrics } from "./types.js"

/**
 * Collects and aggregates per-request metrics in a bounded ring buffer.
 *
 * Usage:
 * ```ts
 * const metrics = new MetricsCollector(500)
 * const stop = metrics.track("find_element", async () => {
 *   // ... do the work
 * })
 * const sample = await stop
 * const histogram = metrics.histogram()
 * ```
 */
export class MetricsCollector {
	private readonly samples: RequestMetrics[] = []
	private readonly capacity: number
	private readonly bucketEdges: number[]

	constructor(capacity = 500, bucketEdges: number[] = DEFAULT_BUCKET_EDGES) {
		this.capacity = Math.max(1, capacity)
		this.bucketEdges = [...bucketEdges].sort((a, b) => a - b)
	}

	/** Number of samples currently retained. */
	get size(): number {
		return this.samples.length
	}

	/**
	 * Run `fn` and record a {@link RequestMetrics} sample for it. The returned
	 * promise resolves to the recorded sample (or rejects with the original
	 * error after recording a failed sample).
	 */
	async track<T>(operation: string, fn: () => Promise<T> | T): Promise<RequestMetrics> {
		const startedAt = getNow()
		const cpuBefore = readCpu()
		let ok = true
		let error: string | undefined
		let thrown: Error | undefined
		try {
			await fn()
		} catch (err) {
			ok = false
			error = err instanceof Error ? err.message : String(err)
			thrown = err instanceof Error ? err : new Error(error)
		}
		const durationMs = getNow() - startedAt
		const cpuAfter = readCpu()
		const cpuMs = cpuDeltaMs(cpuBefore, cpuAfter)

		const sample: RequestMetrics = {
			operation,
			durationMs,
			startedAt,
			timestamp: Date.now(),
			cpuMs,
			memory: readMemory(),
			ok,
			error,
		}
		this.record(sample)
		if (!ok && thrown) {
			throw thrown
		}
		return sample
	}

	/** Record a pre-built sample (e.g. from a manual timing). */
	record(sample: RequestMetrics): void {
		this.samples.push(sample)
		if (this.samples.length > this.capacity) {
			this.samples.splice(0, this.samples.length - this.capacity)
		}
	}

	/** All retained samples, oldest first. */
	list(): RequestMetrics[] {
		return [...this.samples]
	}

	/** The most recent `limit` samples, newest first. */
	tail(limit = 50): RequestMetrics[] {
		return this.samples.slice(-limit).reverse()
	}

	/** Clear all retained samples. */
	clear(): void {
		this.samples.length = 0
	}

	/**
	 * Build a latency histogram from the retained samples. Buckets are
	 * half-open over the configured edges; the final bucket is unbounded.
	 */
	histogram(): HistogramBucket[] {
		const buckets: HistogramBucket[] = this.bucketEdges.map((maxMs) => ({ maxMs, count: 0 }))
		buckets.push({ maxMs: Infinity, count: 0 })
		for (const sample of this.samples) {
			for (const bucket of buckets) {
				if (sample.durationMs <= bucket.maxMs) {
					bucket.count++
					break
				}
			}
		}
		return buckets
	}

	/** Aggregate statistics over the retained samples. */
	summary(): {
		count: number
		minMs: number
		maxMs: number
		avgMs: number
		p50Ms: number
		p95Ms: number
		errorRate: number
	} {
		const n = this.samples.length
		if (n === 0) {
			return { count: 0, minMs: 0, maxMs: 0, avgMs: 0, p50Ms: 0, p95Ms: 0, errorRate: 0 }
		}
		const durations = this.samples.map((s) => s.durationMs).sort((a, b) => a - b)
		const sum = durations.reduce((acc, v) => acc + v, 0)
		const errors = this.samples.filter((s) => !s.ok).length
		const at = (i: number): number => durations[i] ?? 0
		return {
			count: n,
			minMs: at(0),
			maxMs: at(n - 1),
			avgMs: sum / n,
			p50Ms: at(Math.floor(0.5 * n)),
			p95Ms: at(Math.min(n - 1, Math.floor(0.95 * n))),
			errorRate: errors / n,
		}
	}
}
