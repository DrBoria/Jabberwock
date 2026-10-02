import type { JsonEvent, JsonEventCost } from "@/types/json-events.js"

export function createJsonOutputWriter(
	mode: string,
	stdout?: NodeJS.WriteStream,
	requestIdProvider?: () => string | undefined,
) {
	const writeStream = stdout ?? process.stdout
	const events: JsonEvent[] = []
	const pendingWrites = new Set<Promise<void>>()
	let lastCost: JsonEventCost | undefined
	const requestId = requestIdProvider ?? (() => undefined)

	function emitEvent(event: JsonEvent): void {
		const id = event.requestId ?? requestId()
		const payload = id ? { ...event, requestId: id } : event
		events.push(payload)
		if (mode === "stream-json") {
			outputLine(payload)
		}
	}

	function outputLine(data: unknown): void {
		writeToStdout(JSON.stringify(data) + "\n")
	}

	function outputFinalResult(success: boolean, content?: string): void {
		writeToStdout(
			JSON.stringify(
				{
					type: "result",
					success,
					content,
					cost: lastCost,
					events: events.filter((e) => e.type !== "result"),
				},
				null,
				2,
			) + "\n",
		)
	}

	function writeToStdout(content: string): void {
		const writePromise = new Promise<void>((resolve, reject) => {
			writeStream.write(content, (error?: Error | null) => {
				if (error) reject(error)
				else resolve()
			})
		})
		pendingWrites.add(writePromise)
		void writePromise.finally(() => {
			pendingWrites.delete(writePromise)
		})
	}

	async function flush(): Promise<void> {
		while (pendingWrites.size > 0) {
			await Promise.all([...pendingWrites])
		}
	}

	function getEvents(): JsonEvent[] {
		return events
	}

	return {
		get lastCost() {
			return lastCost
		},
		set lastCost(value: JsonEventCost | undefined) {
			lastCost = value
		},
		emitEvent,
		outputFinalResult,
		flush,
		getEvents,
	}
}

/** JsonOutputWriter instance type */
export type JsonOutputWriter = ReturnType<typeof createJsonOutputWriter>
