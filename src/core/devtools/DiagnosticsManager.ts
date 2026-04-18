import { DiagnosticLog, DiagnosticLevel, PerformanceMetric, MstPatch } from "@jabberwock/types"
import util from "util"
import { Tracer } from "./Tracer"
import { ResourceMonitor } from "./ResourceMonitor"
import { TimelineTracker } from "./TimelineTracker"
import { LifecycleManager } from "./LifecycleManager"
import { LogFileManager } from "./LogFileManager"
import { TimelineEvent, TimelineFilters } from "./types/TimelineTypes"
import { ExtendedDiagnosticSnapshot } from "./types"

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
		this.tracer = new Tracer((m, l) => this.log(m, l))
		this.monitor = new ResourceMonitor()
		this.timeline = new TimelineTracker(this.monitor)
		this.lifecycle = new LifecycleManager(this.tracer, this.timeline, (n, d, s) => this.recordMetric(n, d, s))
		this.logFile = new LogFileManager()
	}

	public setLogFilePath(filePath: string) {
		this.logFile.setLogFilePath(filePath)
	}

	public registerConsoleInterceptor() {
		const g = globalThis as any
		if (g.__JABBERWOCK_DIAGNOSTICS_INTERCEPTING__) return
		g.__JABBERWOCK_DIAGNOSTICS_INTERCEPTING__ = true

		const originalMethods: Array<keyof Console> = ["log", "warn", "error", "debug"]
		originalMethods.forEach((method) => {
			const original = console[method] as (...args: any[]) => void
			;(console[method] as any) = (...args: any[]) => {
				const message = util.format(...args)
				// Use the static log if available, or just ignore if no manager is active
				DiagnosticsManager.instance?.log(message, method === "log" ? "info" : (method as DiagnosticLevel))
				original.apply(console, args)
			}
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
	public recordToolStart(taskId: string, toolName: string, params: any): string {
		return this.tracer.recordToolStart(taskId, toolName, params)
	}
	public recordToolEnd(toolId: string, status: "success" | "failure", result?: any, error?: string) {
		this.tracer.recordToolEnd(toolId, status, result, error)
	}

	public recordMstPatch(patch: any) {
		this.mstPatches.push({ ...patch, timestamp: Date.now() })
		if (this.mstPatches.length > 500) this.mstPatches.shift()
	}

	public setCurrentAction(action: string) {
		this.currentAction = action
		this.log(`[ACTION] ${action}`, "debug")
	}

	public getTimeline(filters: TimelineFilters = {}) {
		return this.timeline.getTimeline(filters)
	}

	public getSnapshot(): ExtendedDiagnosticSnapshot {
		const traces = this.tracer.getTraces()
		return {
			timestamp: Date.now(),
			activeTasks: traces.taskTraces.filter((t) => t.status === "active").length,
			totalMessages: this.logs.length,
			toolCalls: Object.keys(traces.toolTraces).length,
			errors: this.logs.filter((l) => l.level === "error").length,
			logs: this.logs,
			metrics: this.metrics,
			mstPatches: this.mstPatches,
			resources: this.monitor.getSnapshot(),
			taskTraces: traces.taskTraces,
			toolTraces: traces.toolTraces,
			currentAction: this.currentAction,
		}
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
