import type { JsonEvent, JsonEventCost } from "@/types/json-events.js"

export class JsonOutputWriter {
	private stdout: NodeJS.WriteStream
	private events: JsonEvent[] = []
	private pendingWrites = new Set<Promise<void>>()
	public lastCost: JsonEventCost | undefined
	private requestIdProvider: () => string | undefined
	private mode: string

	constructor(mode: string, stdout?: NodeJS.WriteStream, requestIdProvider?: () => string | undefined) {
		this.mode = mode
		this.stdout = stdout ?? process.stdout
		this.requestIdProvider = requestIdProvider ?? (() => undefined)
	}

	emitEvent(event: JsonEvent): void {
		const requestId = event.requestId ?? this.requestIdProvider()
		const payload = requestId ? { ...event, requestId } : event
		this.events.push(payload)
		if (this.mode === "stream-json") {
			this.outputLine(payload)
		}
	}

	private outputLine(data: unknown): void {
		this.writeToStdout(JSON.stringify(data) + "\n")
	}

	outputFinalResult(success: boolean, content?: string): void {
		this.writeToStdout(
			JSON.stringify(
				{
					type: "result",
					success,
					content,
					cost: this.lastCost,
					events: this.events.filter((e) => e.type !== "result"),
				},
				null,
				2,
			) + "\n",
		)
	}

	private writeToStdout(content: string): void {
		const writePromise = new Promise<void>((resolve, reject) => {
			this.stdout.write(content, (error?: Error | null) => {
				if (error) reject(error)
				else resolve()
			})
		})
		this.pendingWrites.add(writePromise)
		void writePromise.finally(() => {
			this.pendingWrites.delete(writePromise)
		})
	}

	async flush(): Promise<void> {
		while (this.pendingWrites.size > 0) {
			await Promise.all([...this.pendingWrites])
		}
	}

	getEvents(): JsonEvent[] {
		return this.events
	}
}
