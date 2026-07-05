import { z } from "zod"

import { ServerConfigSchema } from "./schemas"
import {
	stdioFieldsErrorMessage,
	sseFieldsErrorMessage,
	streamableHttpFieldsErrorMessage,
	mixedFieldsErrorMessage,
	missingFieldsErrorMessage,
} from "./schemas"

// ─── Validation helpers ──────────────────────────────────────────────

export function inferUrlServerType(config: Record<string, unknown>): void {
	const urlStr = config.url as string
	const isWebSocketUrl = urlStr.startsWith("ws://") || urlStr.startsWith("wss://")
	if (isWebSocketUrl) {
		config.type = "websocket"
	} else {
		throw new Error(
			"Configuration with 'url' must explicitly specify 'type' as 'sse', 'websocket', or 'streamable-http'.",
		)
	}
}

export function validateTransportType(configType: string | undefined): void {
	if (!configType) {
		return
	}
	const validTypes = ["stdio", "sse", "websocket", "streamable-http", "interactiveApp", "tool"]
	if (!validTypes.includes(configType)) {
		throw new Error(
			"Server type must be 'stdio', 'sse', 'websocket', 'streamable-http', 'interactiveApp', or 'tool'",
		)
	}
}

export function validateTransportFields(
	transportType: string | undefined,
	hasStdioFields: boolean,
	hasUrlFields: boolean,
): void {
	if (transportType === "stdio" && !hasStdioFields) {
		throw new Error(stdioFieldsErrorMessage)
	}
	if (transportType === "sse" && !hasUrlFields) {
		throw new Error(sseFieldsErrorMessage)
	}
	if (transportType === "websocket" && !hasUrlFields) {
		throw new Error("WebSocket config must have a 'url' field")
	}
	if (transportType === "streamable-http" && !hasUrlFields) {
		throw new Error(streamableHttpFieldsErrorMessage)
	}
}

export function formatValidationError(validationError: unknown, serverName?: string): never {
	if (validationError instanceof z.ZodError) {
		const errorMessages = validationError.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join("; ")
		throw new Error(
			serverName
				? `Invalid configuration for server "${serverName}": ${errorMessages}`
				: `Invalid server configuration: ${errorMessages}`,
		)
	}
	throw validationError
}

export function validateServerConfig(
	config: Record<string, unknown>,
	serverName?: string,
): z.infer<typeof ServerConfigSchema> {
	const hasStdioFields = config.command !== undefined
	const hasUrlFields = config.url !== undefined

	if (hasStdioFields && hasUrlFields) {
		throw new Error(mixedFieldsErrorMessage)
	}

	if (!config.type && hasStdioFields) {
		config.type = "stdio"
	}

	if (hasUrlFields && !config.type) {
		inferUrlServerType(config)
	}

	validateTransportType(config.type as string | undefined)
	validateTransportFields(config.mcpTransport as string | undefined, hasStdioFields, hasUrlFields)

	if (!hasStdioFields && !hasUrlFields) {
		throw new Error(missingFieldsErrorMessage)
	}

	try {
		return ServerConfigSchema.parse(config)
	} catch (validationError) {
		formatValidationError(validationError, serverName)
	}
}
