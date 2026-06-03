import type { DiagnosticLog, DiagnosticLevel, PerformanceMetric, MstPatch } from "@jabberwock/types"
import util from "util"
import { Tracer } from "./Tracer.js"
import { ResourceMonitor } from "./ResourceMonitor.js"
import { TimelineTracker } from "./TimelineTracker.js"
import { LifecycleManager } from "./LifecycleManager.js"
import { LogFileManager } from "./LogFileManager.js"
import type { TimelineFilters } from "./types.js"
import type { ExtendedDiagnosticSnapshot, SnapshotFilters } from "./types.js"

export class DiagnosticsManager {
	private logs: DiagnosticLog[] = []
	private metrics: PerformanceMetric[] = []
	private mstPatches: MstPatch[] = []
	private tracer: Tracer
	private monitor: ResourceMonitor
	private timeline: TimelineTracker
	private lifecycle: LifecycleManager
	private logFile: LogFileManager

	private MAX_LOGS = 1000
	private MAX_METRICS = 500
	private currentAction: string = ""
	private static instance: DiagnosticsManager | undefined
	private isIntercepting = false

	constructor() {
		DiagnosticsManager.instance = this
		this.tracer = new Tracer((m, l) => this.log(m, l as DiagnosticLevel))
		this.monitor = new ResourceMonitor()
		this.timeline = new TimelineTracker(this.monitor)
		this.lifecycle = new LifecycleManager(this.tracer, this.timeline, (n, d, s) => this.recordMetric(n, d, s))
		this.logFile = new LogFileManager()
	}

	public setLogFilePath(filePath: string) {
		this.logFile.setLogFilePath(filePath)
	}

	public registerConsoleInterceptor() {
		const g = globalThis as Record<string, unknown>
		if (g.__JABBERWOCK_DIAGNOSTICS_INTERCEPTING__) return
		g.__JABBERWOCK_DIAGNOSTICS_INTERCEPTING__ = true

		const originalMethods: Array<keyof Console> = ["log", "warn", "error", "debug"]
		originalMethods.forEach((method) => {
			const original = console[method] as (...args: unknown[]) => void
			Object.defineProperty(console, method, {
				value: (...args: unknown[]) => {
					const message = util.format(...args)
					// Use the static log if available, or just ignore if no manager is active
					DiagnosticsManager.instance?.log(message, method === "log" ? "info" : (method as DiagnosticLevel))
					original.apply(console, args)
				},
				writable: true,
				configurable: true,
			})
		})
		this.log("[DiagnosticsManager] Console interceptor registered successfully", "info")
	}

	public log(message: string, level: DiagnosticLevel = "info") {
		this.logs.push({ timestamp: Date.now(), message, level })
		if (this.logs.length > this.MAX_LOGS) this.logs.shift()
		if (["info", "warn", "error"].includes(level)) this.currentAction = message
		this.timeline.record({ type: "log", level, message })
		this.logFile.append(message, level)
	}

	public recordMetric(name: string, durationMs: number, status: "success" | "failure") {
		this.metrics.push({
			id: Math.random().toString(36).substring(7),
			name,
			durationMs,
			status,
			timestamp: Date.now(),
		})
		if (this.metrics.length > this.MAX_METRICS) this.metrics.shift()
		this.timeline.record({
			type: "metric",
			level: "info",
			message: `Metric: ${name} (${durationMs}ms) - ${status}`,
			metadata: { name, durationMs, status },
		})
	}

	// TRACING API
	public recordTaskStart(taskId: string, type: "primary" | "subtask", input: string, parentId?: string) {
		this.tracer.recordTaskStart(taskId, type, input, parentId)
	}
	public recordTaskEnd(taskId: string, status: "completed" | "aborted", output?: string) {
		this.tracer.recordTaskEnd(taskId, status, output)
	}
	public recordToolStart(taskId: string, toolName: string, params: unknown): string {
		return this.tracer.recordToolStart(taskId, toolName, params)
	}
	public recordToolEnd(toolId: string, status: "success" | "failure", result?: unknown, error?: string) {
		this.tracer.recordToolEnd(toolId, status, result, error)
	}
	public recordTodoChange(
		taskId: string,
		action: "created" | "updated" | "cleared",
		count: number,
		details?: string,
	) {
		const msg = `[TODO-WATCHER] [${action.toUpperCase()}] taskId: ${taskId}, count: ${count}${details ? `, ${details}` : ""}`
		this.log(msg, "info")
	}

	public recordMstPatch(patch: { op: "add" | "remove" | "replace"; path: string; value?: unknown }) {
		this.mstPatches.push({ ...patch, timestamp: Date.now() })
		if (this.mstPatches.length > 500) this.mstPatches.shift()
	}

	public setCurrentAction(action: string) {
		this.currentAction = action
		this.log(`[ACTION] ${action}`, "debug")
	}

	public getAllLogs(): DiagnosticLog[] {
		return [...this.logs]
	}

	public getTimeline(filters: TimelineFilters = {}) {
		return this.timeline.getTimeline(filters)
	}

	public getSnapshot(filters?: SnapshotFilters): ExtendedDiagnosticSnapshot {
		const traces = this.tracer.getTraces()
		const {
			limit = 10,
			offset: offsetVal = 0,
			level,
			search,
			includeLogs = true,
			includeMetrics = false,
			includePatches = false,
			includeTraces = false,
			includeResources = false,
		} = filters ?? {}

		// Build summary
		const snapshot: ExtendedDiagnosticSnapshot = {
			timestamp: Date.now(),
			activeTasks: traces.taskTraces.filter((t) => t.status === "active").length,
			totalMessages: this.logs.length,
			toolCalls: Object.keys(traces.toolTraces).length,
			errors: this.logs.filter((l) => l.level === "error").length,
			currentAction: this.currentAction,
			// Always include required DiagnosticSnapshot fields (empty arrays if filtered out)
			logs: [],
			metrics: [],
			resources: [],
		}

		// Filter logs
		if (includeLogs) {
			let filteredLogs = [...this.logs]
			if (level) {
				filteredLogs = filteredLogs.filter((l) => l.level === level)
			}
			if (search) {
				const searchLower = search.toLowerCase()
				filteredLogs = filteredLogs.filter((l) => l.message.toLowerCase().includes(searchLower))
			}
			// Pagination from end (newest first), with limit validation
			if (limit > 10) {
				throw new Error(`Limit cannot exceed 10, got ${limit}`)
			}
			if (limit >= 0) {
				const endIndex = filteredLogs.length - offsetVal
				const startIndex = Math.max(0, endIndex - limit)
				filteredLogs = filteredLogs.slice(startIndex, endIndex).reverse()
			}
			snapshot.logs = filteredLogs
		}

		if (includeMetrics) {
			snapshot.metrics = this.metrics
		}
		if (includePatches) {
			snapshot.mstPatches = this.mstPatches
		}
		if (includeTraces) {
			snapshot.taskTraces = traces.taskTraces
			snapshot.toolTraces = traces.toolTraces
		}
		if (includeResources) {
			snapshot.resources = this.monitor.getSnapshot()
		}

		return snapshot
	}

	public clear() {
		this.logs = []
		this.metrics = []
		this.mstPatches = []
		this.tracer.clear()
		this.timeline.clear()
	}

	public getTracer() {
		return this.tracer
	}
	public getMonitor() {
		return this.monitor
	}
	public getTimelineInstance() {
		return this.timeline
	}
	public getLifecycle() {
		return this.lifecycle
	}
}

export const diagnosticsManager = new DiagnosticsManager()
