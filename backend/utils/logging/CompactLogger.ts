/**
 * @fileoverview Implementation of the compact logging system's main logger class
 */

import { ILogger, LogMeta, CompactLogEntry, LogLevel } from "./types"
import { CompactTransport } from "./CompactTransport"
import type { CompactTransport as CompactTransportType } from "./CompactTransport"

/**
 * Main logger implementation providing compact, efficient logging capabilities
 * @implements {ILogger}
 */
export function CompactLogger(transport?: CompactTransportType, parentMeta?: LogMeta): ILogger {
	const _transport = transport ?? CompactTransport()

	/**
	 * Handles logging of error and fatal messages with special error object processing
	 * @private
	 * @param level - The log level (error or fatal)
	 * @param message - The message or Error object to log
	 * @param meta - Optional metadata to include
	 */
	function handleErrorLog(level: "error" | "fatal", message: string | Error, meta?: LogMeta): void {
		if (message instanceof Error) {
			const errorMeta: LogMeta = {
				...meta,
				ctx: meta?.ctx ?? level,
				error: {
					name: message.name,
					message: message.message,
					stack: message.stack,
				},
			}
			log(level, message.message, combineMeta(errorMeta))
		} else {
			log(level, message, combineMeta(meta))
		}
	}

	/**
	 * Combines parent and current metadata with proper context handling
	 * @private
	 * @param meta - The current metadata to combine with parent metadata
	 * @returns Combined metadata or undefined if no metadata exists
	 */
	function combineMeta(meta?: LogMeta): LogMeta | undefined {
		if (!parentMeta) {
			return meta
		}
		if (!meta) {
			return parentMeta
		}
		return {
			...parentMeta,
			...meta,
			ctx: meta.ctx || parentMeta.ctx,
		}
	}

	/**
	 * Core logging function that processes and writes log entries
	 * @private
	 * @param level - The log level
	 * @param message - The message to log
	 * @param meta - Optional metadata to include
	 */
	function log(level: LogLevel, message: string, meta?: LogMeta): void {
		const entry: CompactLogEntry = {
			t: Date.now(),
			l: level,
			m: message,
			c: meta?.ctx,
			d: meta ? (({ ctx: _, ...rest }) => (Object.keys(rest).length > 0 ? rest : undefined))(meta) : undefined,
		}

		_transport.write(entry)
	}

	return {
		/**
		 * Logs a debug level message
		 * @param message - The message to log
		 * @param meta - Optional metadata to include
		 */
		debug(message: string, meta?: LogMeta): void {
			log("debug", message, combineMeta(meta))
		},

		/**
		 * Logs an info level message
		 * @param message - The message to log
		 * @param meta - Optional metadata to include
		 */
		info(message: string, meta?: LogMeta): void {
			log("info", message, combineMeta(meta))
		},

		/**
		 * Logs a warning level message
		 * @param message - The message to log
		 * @param meta - Optional metadata to include
		 */
		warn(message: string, meta?: LogMeta): void {
			log("warn", message, combineMeta(meta))
		},

		/**
		 * Logs an error level message
		 * @param message - The error message or Error object
		 * @param meta - Optional metadata to include
		 */
		error(message: string | Error, meta?: LogMeta): void {
			handleErrorLog("error", message, meta)
		},

		/**
		 * Logs a fatal level message
		 * @param message - The error message or Error object
		 * @param meta - Optional metadata to include
		 */
		fatal(message: string | Error, meta?: LogMeta): void {
			handleErrorLog("fatal", message, meta)
		},

		/**
		 * Creates a child logger inheriting this logger's metadata
		 * @param meta - Additional metadata for the child logger
		 * @returns A new logger instance with combined metadata
		 */
		child(meta: LogMeta): ILogger {
			const combinedMeta = parentMeta ? { ...parentMeta, ...meta } : meta
			return CompactLogger(_transport, combinedMeta)
		},

		/**
		 * Closes the logger and its transport
		 */
		close(): void {
			_transport.close()
		},
	}
}

export type CompactLogger = ReturnType<typeof CompactLogger>
