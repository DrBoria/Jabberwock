import fs from "fs"
import path from "path"
import { DiagnosticLevel } from "@jabberwock/types"

export class LogFileManager {
	private logFilePath?: string
	private logBuffer: string[] = []
	private flushTimeout?: NodeJS.Timeout

	public setLogFilePath(filePath: string) {
		this.logFilePath = filePath
		fs.mkdirSync(path.dirname(filePath), { recursive: true })
	}

	public append(message: string, level: DiagnosticLevel) {
		if (!this.logFilePath) return
		this.logBuffer.push(`[${new Date().toISOString()}][${level.toUpperCase()}] ${message}`)

		if (!this.flushTimeout) {
			this.flushTimeout = setTimeout(() => this.flush(), 500)
		}
	}

	private flush() {
		this.flushTimeout = undefined
		if (!this.logFilePath || !this.logBuffer.length) return

		try {
			fs.appendFileSync(this.logFilePath, this.logBuffer.join("\n") + "\n")
			this.logBuffer = []
		} catch (error) {
			console.error("[LogFileManager] Failed to write to log file:", error)
		}
	}

	public dispose() {
		if (this.flushTimeout) {
			clearTimeout(this.flushTimeout)
			this.flush()
		}
	}
}
