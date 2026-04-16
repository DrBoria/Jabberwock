import {
	DiagnosticLog,
	DiagnosticSnapshot,
	DiagnosticLevel,
	PerformanceMetric,
	ResourceSnapshot,
	MstPatch,
} from "@jabberwock/types"

export interface ToolTrace {
	id: string
	taskId: string
	toolName: string
	params: any
	startTime: number
	endTime?: number
	durationMs?: number
	status?: "success" | "failure" | "pending"
	result?: any
	error?: string
}

export interface TaskTrace {
	id: string
	parentId?: string
	type: "primary" | "subtask"
	input: string
	startTime: number
	endTime?: number
	durationMs?: number
	status: "active" | "completed" | "aborted"
	output?: string
	toolCalls: string[]
}

export interface ExtendedDiagnosticSnapshot extends DiagnosticSnapshot {
	taskTraces: TaskTrace[]
	toolTraces: Record<string, ToolTrace>
	logs: DiagnosticLog[]
	metrics: PerformanceMetric[]
	mstPatches: MstPatch[]
	resources: ResourceSnapshot[]
	currentAction: string
	timestamp: number
	activeTasks: number
	totalMessages: number
	toolCalls: number
	errors: number
}
