import { DiagnosticLevel, MstPatch, ResourceSnapshot } from "@jabberwock/types"

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
	metadata?: Record<string, any>
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
