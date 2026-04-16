import { ToolTrace, TaskTrace } from "./types"

export class Tracer {
	private taskTraces: Map<string, TaskTrace> = new Map()
	private toolTraces: Map<string, ToolTrace> = new Map()
	private traceOrder: string[] = []
	private readonly MAX_TRACES = 200

	constructor(private logFn: (msg: string, level?: any) => void) {}

	public recordTaskStart(taskId: string, type: "primary" | "subtask", input: string, parentId?: string) {
		const trace: TaskTrace = {
			id: taskId,
			parentId,
			type,
			input: input.length > 1000 ? input.substring(0, 1000) + "... [truncated]" : input,
			startTime: Date.now(),
			status: "active",
			toolCalls: [],
		}
		this.taskTraces.set(taskId, trace)
		this.traceOrder.push(taskId)
		this.enforceTraceLimit()
	}

	public recordTaskEnd(taskId: string, status: "completed" | "aborted", output?: string) {
		const trace = this.taskTraces.get(taskId)
		if (trace) {
			trace.status = status
			trace.endTime = Date.now()
			trace.durationMs = trace.endTime - trace.startTime
			trace.output = output && output.length > 1000 ? output.substring(0, 1000) + "... [truncated]" : output
			return trace.durationMs
		}
		return 0
	}

	public recordToolStart(taskId: string, toolName: string, params: any): string {
		const toolId = `${toolName}-${Math.random().toString(36).substring(7)}`
		const trace: ToolTrace = {
			id: toolId,
			taskId,
			toolName,
			params: this.sanitize(params),
			startTime: Date.now(),
			status: "pending",
		}
		this.toolTraces.set(toolId, trace)
		this.taskTraces.get(taskId)?.toolCalls.push(toolId)
		this.detectCycle(taskId, toolName, params)
		return toolId
	}

	public recordToolEnd(toolId: string, status: "success" | "failure", result?: any, error?: string) {
		const trace = this.toolTraces.get(toolId)
		if (trace) {
			trace.status = status
			trace.endTime = Date.now()
			trace.durationMs = trace.endTime - trace.startTime
			trace.result = result ? this.sanitize(result) : undefined
			trace.error = error
			return { durationMs: trace.durationMs, toolName: trace.toolName, taskId: trace.taskId }
		}
		return undefined
	}

	public getTraces() {
		return {
			taskTraces: Array.from(this.taskTraces.values()),
			toolTraces: Object.fromEntries(this.toolTraces),
		}
	}

	public clear() {
		this.taskTraces.clear()
		this.toolTraces.clear()
		this.traceOrder = []
	}

	private sanitize(params: any): any {
		if (!params || typeof params !== "object") return params
		try {
			const sanitized = JSON.parse(JSON.stringify(params))
			const redact = (obj: any) => {
				for (const key in obj) {
					if (typeof obj[key] === "string") {
						const lowKey = key.toLowerCase()
						if (lowKey.includes("key") || lowKey.includes("token") || lowKey.includes("password")) {
							obj[key] = "********"
						} else if (obj[key].length > 500) {
							obj[key] = obj[key].substring(0, 500) + "... [truncated]"
						}
					} else if (obj[key] && typeof obj[key] === "object") redact(obj[key])
				}
			}
			redact(sanitized)
			return sanitized
		} catch {
			return "[Non-serializable]"
		}
	}

	private detectCycle(taskId: string, toolName: string, params: any) {
		const task = this.taskTraces.get(taskId)
		if (!task) return

		const recent = task.toolCalls
			.slice(-5)
			.map((id) => this.toolTraces.get(id))
			.filter((t) => t?.toolName === toolName)

		if (recent.length >= 3) {
			const sanitizedParams = JSON.stringify(this.sanitize(params))
			const identicalCount = recent.filter((t) => JSON.stringify(t?.params) === sanitizedParams).length

			if (identicalCount >= 3) {
				this.logFn(`[Tracer] Potential Cycle Detected: ${toolName} for task ${taskId}`, "warn")
			}
		}
	}

	private enforceTraceLimit() {
		if (this.traceOrder.length > this.MAX_TRACES) {
			const id = this.traceOrder.shift()
			if (id) {
				this.taskTraces.get(id)?.toolCalls.forEach((tid) => this.toolTraces.delete(tid))
				this.taskTraces.delete(id)
			}
		}
	}
}
