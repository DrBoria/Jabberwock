import type { DiagnosticLog, MstPatch, PerformanceMetric } from "@jabberwock/types"

import type { Tracer } from "./Tracer.js"
import { ResourceMonitor } from "./ResourceMonitor.js"
import type { ExtendedDiagnosticSnapshot, SnapshotFilters } from "../types.js"

function buildSnapshotSummary(
	logs: DiagnosticLog[],
	traces: ReturnType<Tracer["getTraces"]>,
	currentAction: string,
): ExtendedDiagnosticSnapshot {
	return {
		timestamp: Date.now(),
		activeTasks: traces.taskTraces.filter((t) => t.status === "active").length,
		totalMessages: logs.length,
		toolCalls: Object.keys(traces.toolTraces).length,
		errors: logs.filter((l) => l.level === "error").length,
		currentAction,
		logs: [],
		metrics: [],
		resources: [],
	}
}

function filterAndPaginateLogs(
	logs: DiagnosticLog[],
	level?: string,
	search?: string,
	limit = 10,
	offsetVal = 0,
): DiagnosticLog[] {
	let filteredLogs = [...logs]
	if (level) {
		filteredLogs = filteredLogs.filter((l) => l.level === level)
	}
	if (search) {
		const searchLower = search.toLowerCase()
		filteredLogs = filteredLogs.filter((l) => l.message.toLowerCase().includes(searchLower))
	}
	if (limit > 10) {
		throw new Error(`Limit cannot exceed 10, got ${limit}`)
	}
	if (limit >= 0) {
		const endIndex = filteredLogs.length - offsetVal
		const startIndex = Math.max(0, endIndex - limit)
		filteredLogs = filteredLogs.slice(startIndex, endIndex).reverse()
	}
	return filteredLogs
}

function attachLogs(
	snapshot: ExtendedDiagnosticSnapshot,
	logs: DiagnosticLog[],
	level?: string,
	search?: string,
	limit = 10,
	offsetVal = 0,
): void {
	snapshot.logs = filterAndPaginateLogs(logs, level, search, limit, offsetVal)
}

function attachTraces(snapshot: ExtendedDiagnosticSnapshot, traces: ReturnType<Tracer["getTraces"]>): void {
	snapshot.taskTraces = traces.taskTraces
	snapshot.toolTraces = traces.toolTraces
}

function applySnapshotFilters(
	snapshot: ExtendedDiagnosticSnapshot,
	traces: ReturnType<Tracer["getTraces"]>,
	logs: DiagnosticLog[],
	metrics: PerformanceMetric[],
	mstPatches: MstPatch[],
	monitor: ResourceMonitor,
	filters?: SnapshotFilters,
): void {
	if (!filters) return

	const limit = filters.limit ?? 10
	const offsetVal = filters.offset ?? 0
	const { level, search, includeMetrics, includePatches, includeTraces, includeResources } = filters
	const includeLogs = filters.includeLogs !== false

	if (includeLogs) attachLogs(snapshot, logs, level, search, limit, offsetVal)
	if (includeMetrics) snapshot.metrics = metrics
	if (includePatches) snapshot.mstPatches = mstPatches
	if (includeTraces) attachTraces(snapshot, traces)
	if (includeResources) snapshot.resources = monitor.getSnapshot()
}

export function buildSnapshot(
	logs: DiagnosticLog[],
	metrics: PerformanceMetric[],
	mstPatches: MstPatch[],
	tracer: Tracer,
	monitor: ResourceMonitor,
	currentAction: string,
	filters?: SnapshotFilters,
): ExtendedDiagnosticSnapshot {
	const traces = tracer.getTraces()
	const snapshot = buildSnapshotSummary(logs, traces, currentAction)
	applySnapshotFilters(snapshot, traces, logs, metrics, mstPatches, monitor, filters)
	return snapshot
}
