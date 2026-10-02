/**
 * @fileoverview Implementation of the compact logging transport system with file output capabilities
 */

import { writeFileSync, mkdirSync } from "fs"
import { dirname } from "path"
import { CompactTransportConfig, ICompactTransport, CompactLogEntry, LogLevel, LOG_LEVELS } from "./types"

/**
 * Default configuration for the transport
 */
const DEFAULT_CONFIG: CompactTransportConfig = {
	level: "debug",
	fileOutput: {
		enabled: true,
		path: "./logs/app.log",
	},
}

/**
 * Determines if a log entry should be processed based on configured minimum level
 * @param configLevel - The minimum log level from "configuration"
 * @param entryLevel - The level of the current log entry
 * @returns Whether the entry should be processed
 */
function isLevelEnabled(configLevel: LogLevel, entryLevel: string): boolean {
	const configIdx = LOG_LEVELS.indexOf(configLevel)
	const entryIdx = LOG_LEVELS.indexOf(entryLevel as LogLevel)
	return entryIdx >= configIdx
}

/**
 * Implements the compact logging transport with file output support
 * @implements {ICompactTransport}
 */
export interface CompactTransportInstance extends ICompactTransport {
	config: CompactTransportConfig
}

export function CompactTransport(config: CompactTransportConfig = DEFAULT_CONFIG): CompactTransportInstance {
	let sessionStart: number = Date.now()
	let lastTimestamp: number = sessionStart
	let filePath: string | undefined
	let initialized: boolean = false

	if (config.fileOutput?.enabled) {
		filePath = config.fileOutput.path
	}

	/**
	 * Ensures the log file is initialized with proper directory structure and session start marker
	 * @private
	 * @throws {Error} If file initialization fails
	 */
	function ensureInitialized(): void {
		if (initialized || !filePath) return

		try {
			mkdirSync(dirname(filePath), { recursive: true })
			writeFileSync(filePath, "", { flag: "w" })

			const sessionStartEntry = {
				t: 0,
				l: "info",
				m: "Log session started",
				d: { timestamp: new Date(sessionStart).toISOString() },
			}
			writeFileSync(filePath, JSON.stringify(sessionStartEntry) + "\n", { flag: "w" })

			initialized = true
		} catch (err) {
			throw new Error(`Failed to initialize log file: ${(err as Error).message}`)
		}
	}

	/**
	 * Writes a log entry to configured outputs (console and/or file)
	 * @param entry - The log entry to write
	 */
	function write(entry: CompactLogEntry): void {
		const deltaT = entry.t - lastTimestamp
		lastTimestamp = entry.t

		const compact = {
			...entry,
			t: deltaT,
		}

		const output = JSON.stringify(compact) + "\n"

		// Write to console if level is enabled
		if (config.level && isLevelEnabled(config.level, entry.l)) {
			process.stdout.write(output)
		}

		// Write to file if enabled
		if (filePath) {
			ensureInitialized()
			writeFileSync(filePath, output, { flag: "a" })
		}
	}

	/**
	 * Closes the transport and writes session end marker
	 */
	function close(): void {
		if (filePath && initialized) {
			const sessionEnd = {
				t: Date.now() - lastTimestamp,
				l: "info",
				m: "Log session ended",
				d: { timestamp: new Date().toISOString() },
			}
			writeFileSync(filePath, JSON.stringify(sessionEnd) + "\n", { flag: "a" })
		}
	}

	return {
		config,
		write,
		close,
	}
}

export type CompactTransport = CompactTransportInstance
