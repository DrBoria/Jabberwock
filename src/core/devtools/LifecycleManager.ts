import { PerformanceMetric } from "@jabberwock/types"
import { Tracer } from "./Tracer"
import { TimelineTracker } from "./TimelineTracker"

export class LifecycleManager {
	private tracer: Tracer
	private timeline: TimelineTracker
	private recordMetricFn: (name: string, durationMs: number, status: "success" | "failure") => void

	constructor(
		tracer: Tracer,
		timeline: TimelineTracker,
		recordMetricFn: (name: string, durationMs: number, status: "success" | "failure") => void,
	) {
		this.tracer = tracer
		this.timeline = timeline
		this.recordMetricFn = recordMetricFn
	}

	public recordTaskStart(taskId: string, type: "primary" | "subtask", input: string, parentId?: string) {
		this.tracer.recordTaskStart(taskId, type, input, parentId)
		this.timeline.record({
			type: "task_lifecycle",
			level: "info",
			message: `Task ${type} started: ${taskId}`,
			taskId,
			metadata: { type, input, parentId },
		})
	}

	public recordTaskEnd(taskId: string, status: "completed" | "aborted", output?: string) {
		const duration = this.tracer.recordTaskEnd(taskId, status, output)
		this.recordMetricFn(`task:${taskId}`, duration, status === "completed" ? "success" : "failure")
		this.timeline.record({
			type: "task_lifecycle",
			level: "info",
			message: `Task ended: ${taskId} (${status})`,
			taskId,
			metadata: { status, output, duration },
		})
	}

	public recordToolStart(taskId: string, toolName: string, params: any) {
		const toolId = this.tracer.recordToolStart(taskId, toolName, params)
		this.timeline.record({
			type: "tool_lifecycle",
			level: "info",
			message: `Tool started: ${toolName}`,
			taskId,
			metadata: { toolName, params, toolId },
		})
		return toolId
	}

	public recordToolEnd(toolId: string, status: "success" | "failure", result?: any, error?: string) {
		const endInfo = this.tracer.recordToolEnd(toolId, status, result, error)
		if (endInfo) {
			this.recordMetricFn(`tool:${endInfo.toolName}`, endInfo.durationMs, status)
			this.timeline.record({
				type: "tool_lifecycle",
				level: "info",
				message: `Tool ended: ${endInfo.toolName} (${status})`,
				taskId: endInfo.taskId,
				metadata: { toolName: endInfo.toolName, status, result, error, durationMs: endInfo.durationMs },
			})
		}
	}
}
