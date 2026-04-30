import { types, Instance } from "mobx-state-tree"

/**
 * A single event recorded in the timeline.
 */
export const TimelineEvent = types.model("TimelineEvent", {
	id: types.identifier,
	type: types.string,
	payload: types.frozen<any>(),
	timestamp: types.optional(types.number, () => Date.now()),
})

/**
 * Event timeline store — records events with timestamps, types, and payloads.
 * Supports querying by time range or event type.
 */
export const EventTimelineStore = types
	.model("EventTimelineStore", {
		events: types.array(TimelineEvent),
		maxEvents: types.optional(types.number, 1000),
	})
	.views((self) => ({
		/**
		 * All events sorted chronologically (oldest first).
		 */
		get sortedEvents() {
			return [...self.events].sort((a, b) => a.timestamp - b.timestamp)
		},

		/**
		 * Events sorted newest first.
		 */
		get recentEvents() {
			return [...self.events].sort((a, b) => b.timestamp - a.timestamp)
		},

		/**
		 * Query events by type.
		 */
		getEventsByType(type: string) {
			return self.events.filter((e) => e.type === type)
		},

		/**
		 * Query events within a time range [start, end].
		 */
		getEventsInRange(start: number, end: number) {
			return self.events.filter((e) => e.timestamp >= start && e.timestamp <= end)
		},

		/**
		 * Query events by type within a time range.
		 */
		getEventsByTypeInRange(type: string, start: number, end: number) {
			return self.events.filter((e) => e.type === type && e.timestamp >= start && e.timestamp <= end)
		},

		/**
		 * Get the latest event of a given type.
		 */
		getLatestEventByType(type: string) {
			const matches = self.events.filter((e) => e.type === type)
			if (matches.length === 0) return null
			return matches.reduce((latest, e) => (e.timestamp > latest.timestamp ? e : latest))
		},

		/**
		 * Total number of events recorded.
		 */
		get totalCount() {
			return self.events.length
		},
	}))
	.actions((self) => ({
		/**
		 * Record a new event.
		 */
		record(event: { id: string; type: string; payload?: any; timestamp?: number }) {
			const ev = TimelineEvent.create({
				id: event.id,
				type: event.type,
				payload: event.payload ?? {},
				timestamp: event.timestamp ?? Date.now(),
			})
			self.events.push(ev)

			// Enforce max events limit (remove oldest)
			if (self.events.length > self.maxEvents) {
				const excess = self.events.length - self.maxEvents
				self.events.splice(0, excess)
			}
		},

		/**
		 * Clear all events.
		 */
		clear() {
			self.events.clear()
		},

		/**
		 * Clear events older than the given timestamp.
		 */
		clearBefore(timestamp: number) {
			self.events.replace(self.events.filter((e) => e.timestamp >= timestamp))
		},

		/**
		 * Clear events of a specific type.
		 */
		clearByType(type: string) {
			self.events.replace(self.events.filter((e) => e.type !== type))
		},
	}))

export function createEventTimelineStore(maxEvents = 1000) {
	return EventTimelineStore.create({ maxEvents })
}

export type IEventTimelineStore = Instance<typeof EventTimelineStore>
export type ITimelineEvent = Instance<typeof TimelineEvent>
