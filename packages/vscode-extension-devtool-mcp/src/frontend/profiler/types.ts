/**
 * Metric shapes and environment-agnostic sampling helpers for the frontend
 * profiler. Memory/CPU readings never throw — when a resource API is
 * unavailable the corresponding fields are simply omitted.
 */

export interface MemorySample {
	/** Resident set size in bytes (Node) or JS heap size (browser), if known. */
	rss?: number
	/** Total JS heap in bytes. */
	heapTotal?: number
	/** Used JS heap in bytes. */
	heapUsed?: number
}

export interface RequestMetrics {
	/** Logical name of the operation (e.g. "find_element", "get_store_state"). */
	operation: string
	/** Wall-clock duration in milliseconds. */
	durationMs: number
	/** Monotonic start time (performance.now() base), for ordering. */
	startedAt: number
	/** Wall-clock timestamp (Date.now()) of the sample. */
	timestamp: number
	/** CPU time delta in milliseconds, if a CPU source is available. */
	cpuMs?: number
	/** Memory snapshot taken at sample time, if available. */
	memory?: MemorySample
	/** Whether the operation completed successfully. */
	ok: boolean
	/** Optional error message when `ok` is false. */
	error?: string
}

export interface HistogramBucket {
	/** Upper bound of the bucket in milliseconds (inclusive). */
	maxMs: number
	/** Number of samples whose duration is <= maxMs and > the previous bound. */
	count: number
}

/** Default latency histogram bucket edges (ms). */
export const DEFAULT_BUCKET_EDGES = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]

export function getNow(): number {
	return typeof performance !== "undefined" ? performance.now() : Date.now()
}

/** Shape of the non-standard browser `performance.memory` API. */
interface BrowserMemory {
	usedJSHeapSize: number
	totalJSHeapSize: number
	jsHeapSizeLimit: number
}

export function readMemory(): MemorySample | undefined {
	// Browser: performance.memory (non-standard but widely available).
	const perfMemory = (performance as unknown as { memory?: BrowserMemory } | undefined)?.memory
	if (perfMemory) {
		return {
			rss: perfMemory.usedJSHeapSize,
			heapTotal: perfMemory.totalJSHeapSize,
			heapUsed: perfMemory.usedJSHeapSize,
		}
	}
	// Node: process.memoryUsage().
	if (typeof process !== "undefined" && typeof process.memoryUsage === "function") {
		const mem = process.memoryUsage()
		return { rss: mem.rss, heapTotal: mem.heapTotal, heapUsed: mem.heapUsed }
	}
	return undefined
}

/** Read cumulative CPU time, or null when unavailable. */
export function readCpu(): CpuTimes | null {
	if (typeof process !== "undefined" && typeof process.cpuUsage === "function") {
		const cpu = process.cpuUsage()
		return { user: cpu.user, system: cpu.system }
	}
	return null
}

interface CpuTimes {
	user: number
	system: number
}

/** Delta between two CPU readings in milliseconds, or undefined. */
export function cpuDeltaMs(before: CpuTimes | null, after: CpuTimes | null): number | undefined {
	if (!before || !after) return undefined
	return (after.user + after.system - before.user - before.system) / 1000
}
