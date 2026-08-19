import type { Command, ModelRecord, WebviewMessage } from "@jabberwock/types"

import { ExtensionHost } from "@/agent/index.js"
import { isRecord } from "@/lib/utils/validation/guards.js"

const REQUEST_TIMEOUT_MS = 10_000

type CommandLike = Pick<Command, "name" | "source" | "filePath" | "description" | "argumentHint">
type ModeLike = { slug: string; name: string }

export function requestFromExtension<T>(
	host: ExtensionHost,
	requestType: WebviewMessage["type"],
	extract: (message: Record<string, unknown>) => T | undefined,
): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		let settled = false
		const cleanup = () => {
			clearTimeout(timeoutId)
			host.off("extensionWebviewMessage", onMessage)
			offError()
		}
		const finish = (fn: () => void) => {
			if (settled) return
			settled = true
			cleanup()
			fn()
		}

		const onMessage = (message: unknown) => {
			if (!isRecord(message)) return
			try {
				const result = extract(message)
				if (result !== undefined) {
					finish(() => resolve(result))
				}
			} catch (error) {
				finish(() => reject(error instanceof Error ? error : new Error(String(error))))
			}
		}

		const offError = host.client.on("error", (error) => {
			finish(() => reject(error))
		})

		const timeoutId = setTimeout(() => {
			finish(() =>
				reject(new Error(`Timed out waiting for ${requestType} response after ${REQUEST_TIMEOUT_MS}ms`)),
			)
		}, REQUEST_TIMEOUT_MS)

		host.on("extensionWebviewMessage", onMessage)
		host.sendToExtension({ type: requestType })
	})
}

export function requestCommands(host: ExtensionHost): Promise<CommandLike[]> {
	return requestFromExtension(host, "requestCommands", (message) =>
		message.type !== "commands"
			? undefined
			: Array.isArray(message.commands)
				? (message.commands as CommandLike[])
				: [],
	)
}

export function requestModes(host: ExtensionHost): Promise<ModeLike[]> {
	return requestFromExtension(host, "requestModes", (message) =>
		message.type !== "modes" ? undefined : Array.isArray(message.modes) ? (message.modes as ModeLike[]) : [],
	)
}

export function requestRooModels(host: ExtensionHost): Promise<ModelRecord> {
	return requestFromExtension(host, "requestRooModels", (message) => {
		if (message.type !== "singleRouterModelFetchResponse") {
			return undefined
		}
		const values = isRecord(message.values) ? message.values : undefined
		if (values?.provider !== "jabberwock") {
			return undefined
		}
		if (message.success === false) {
			throw new Error(
				typeof message.error === "string" && message.error.length > 0
					? message.error
					: "Failed to fetch Jabberwock models",
			)
		}
		return isRecord(values.models) ? (values.models as ModelRecord) : {}
	})
}
