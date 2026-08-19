import type { DiagnosticLevel, MstPatch, ResourceSnapshot } from "@jabberwock/types"

export type TimelineEventType =
	| "task_lifecycle"
	| "tool_lifecycle"
	| "mst_patch"
	| "log"
	| "metric"
	| "resource_sampling"

export interface TimelineEvent {
	id: string
	timestamp: number
	type: TimelineEventType
	level: DiagnosticLevel
	message: string
	taskId?: string
	metadata?: Record<string, unknown>
	resource?: ResourceSnapshot
}

export interface TimelineFilters {
	taskId?: string
	types?: TimelineEventType[]
	levels?: DiagnosticLevel[]
	startTime?: number
	endTime?: number
	limit?: number
}

export interface ToolTrace {
	id: string
	taskId: string
	toolName: string
	params: unknown
	startTime: number
	endTime?: number
	durationMs?: number
	status?: "success" | "failure" | "pending"
	result?: unknown
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

export interface SnapshotFilters {
	/** Max log entries to return (last N). Default: 50. Set to -1 for all. */
	limit?: number
	/** Skip N entries from start (for pagination). */
	offset?: number
	/** Filter by log level. */
	level?: DiagnosticLevel
	/** Filter logs containing this substring (case-insensitive). */
	search?: string
	/** Include log entries. Default: true. */
	includeLogs?: boolean
	/** Include performance metrics. Default: false. */
	includeMetrics?: boolean
	/** Include MST patches. Default: false. */
	includePatches?: boolean
	/** Include task/tool traces. Default: false. */
	includeTraces?: boolean
	/** Include resource snapshots. Default: false. */
	includeResources?: boolean
}

import type { DiagnosticSnapshot } from "@jabberwock/types"

export interface ExtendedDiagnosticSnapshot extends DiagnosticSnapshot {
	taskTraces?: TaskTrace[]
	toolTraces?: Record<string, ToolTrace>
	mstPatches?: MstPatch[]
	currentAction: string
	timestamp: number
	activeTasks: number
	totalMessages: number
	toolCalls: number
	errors: number
}
