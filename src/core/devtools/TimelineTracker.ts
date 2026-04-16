import { TimelineEvent, TimelineFilters } from "./types/TimelineTypes"
import { ResourceMonitor } from "./ResourceMonitor"

export class TimelineTracker {
	private events: TimelineEvent[] = []
	private readonly MAX_EVENTS = 2000
	private monitor: ResourceMonitor

	constructor(monitor: ResourceMonitor) {
		this.monitor = monitor
	}

	public record(event: Omit<TimelineEvent, "id" | "timestamp" | "resource">): TimelineEvent {
		const fullEvent: TimelineEvent = {
			...event,
			id: Math.random().toString(36).substring(7),
			timestamp: Date.now(),
			resource: this.monitor.getLatestSnapshot(),
		}

		this.events.push(fullEvent)
		if (this.events.length > this.MAX_EVENTS) {
			this.events.shift()
		}

		return fullEvent
	}

	public getTimeline(filters: TimelineFilters = {}): TimelineEvent[] {
		let filtered = this.events

		if (filters.taskId) {
			filtered = filtered.filter((e) => e.taskId === filters.taskId)
		}
		if (filters.types && filters.types.length > 0) {
			filtered = filtered.filter((e) => filters.types!.includes(e.type))
		}
		if (filters.levels && filters.levels.length > 0) {
			filtered = filtered.filter((e) => filters.levels!.includes(e.level))
		}
		if (filters.startTime) {
			filtered = filtered.filter((e) => e.timestamp >= filters.startTime!)
		}
		if (filters.endTime) {
			filtered = filtered.filter((e) => e.timestamp <= filters.endTime!)
		}

		const limit = filters.limit || filtered.length
		return filtered.slice(-limit)
	}

	public clear() {
		this.events = []
	}
}
