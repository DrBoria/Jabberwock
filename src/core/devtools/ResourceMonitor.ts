import { ResourceSnapshot } from "@jabberwock/types"
export type { ResourceSnapshot }

export class ResourceMonitor {
	private resources: ResourceSnapshot[] = []
	private readonly MAX_RESOURCES = 100
	private interval?: NodeJS.Timeout
	private lastCpu?: { user: number; system: number; time: number }

	constructor() {
		this.start()
	}

	public getSnapshot() {
		return [...this.resources]
	}

	public getLatestSnapshot(): ResourceSnapshot | undefined {
		return this.resources[this.resources.length - 1]
	}

	public clear() {
		this.resources = []
	}

	public dispose() {
		if (this.interval) clearInterval(this.interval)
	}

	private start() {
		this.interval = setInterval(() => this.capture(), 3000)
	}

	private capture() {
		const mem = process.memoryUsage()
		const now = Date.now()
		const cpu = process.cpuUsage()
		let cpuPercent = 0

		if (this.lastCpu) {
			const userDiff = cpu.user - this.lastCpu.user
			const systemDiff = cpu.system - this.lastCpu.system
			const timeDiff = (now - this.lastCpu.time) * 1000
			if (timeDiff > 0) cpuPercent = ((userDiff + systemDiff) / timeDiff) * 100
		}

		this.lastCpu = { ...cpu, time: now }
		this.resources.push({
			timestamp: now,
			memoryUsage: { rss: mem.rss, heapTotal: mem.heapTotal, heapUsed: mem.heapUsed },
			cpuUsage: Math.min(100, cpuPercent),
		})

		if (this.resources.length > this.MAX_RESOURCES) this.resources.shift()
	}
}
