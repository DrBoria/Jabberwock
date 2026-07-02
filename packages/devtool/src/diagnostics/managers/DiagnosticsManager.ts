import type { DiagnosticLog, DiagnosticLevel, PerformanceMetric, MstPatch } from "@jabberwock/types"
import util from "util"
import { Tracer } from "../trackers/Tracer.js"
import { ResourceMonitor } from "../trackers/ResourceMonitor.js"
import { TimelineTracker } from "../trackers/TimelineTracker.js"
import { LifecycleManager } from "./LifecycleManager.js"
import { LogFileManager } from "./LogFileManager.js"
import type { TimelineFilters } from "../types.js"
import type { ExtendedDiagnosticSnapshot, SnapshotFilters } from "../types.js"
import { buildSnapshot } from "../trackers/SnapshotBuilder.js"

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
		this.log(
			`[TODO-WATCHER] [${action.toUpperCase()}] taskId: ${taskId}, count: ${count}${details ? `, ${details}` : ""}`,
			"info",
		)
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
		return buildSnapshot(
			this.logs,
			this.metrics,
			this.mstPatches,
			this.tracer,
			this.monitor,
			this.currentAction,
			filters,
		)
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
