import * as fs from "fs"
import * as path from "path"
import * as os from "os"

const DEBUG_LOG_PATH = path.join(os.homedir(), ".jabberwock", "cli-debug.log")

let debugLogEnabled = false

export function setDebugLogEnabled(enabled: boolean): void {
	debugLogEnabled = enabled
}

export function debugLog(message: string, data?: unknown): void {
	if (!debugLogEnabled) {
		return
	}
	try {
		const logDir = path.dirname(DEBUG_LOG_PATH)

		if (!fs.existsSync(logDir)) {
			fs.mkdirSync(logDir, { recursive: true })
		}

		const timestamp = new Date().toISOString()

		const entry = data
			? `[${timestamp}] ${message}: ${JSON.stringify(data, null, 2)}\n`
			: `[${timestamp}] ${message}\n`

		fs.appendFileSync(DEBUG_LOG_PATH, entry)
	} catch {
		// NO-OP - don't let logging errors break functionality
	}
}
