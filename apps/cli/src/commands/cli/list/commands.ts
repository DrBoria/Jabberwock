import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

import pWaitFor from "p-wait-for"

import { getProviderDefaultModelId } from "@jabberwock/types"

import { ExtensionHost } from "@/agent/index.js"
import { readWorkspaceTaskSessions } from "@/lib/task-history/index.js"
import { loadToken } from "@/lib/storage/index.js"
import { getDefaultExtensionPath } from "@/lib/utils/env/extension.js"
import { getApiKeyFromEnv } from "@/lib/utils/validation/provider.js"

import { requestCommands, requestModes, requestRooModels } from "./requests.js"
import { outputJson, outputCommandsText, outputModesText, outputModelsText, outputSessionsText } from "./output.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

type ListFormat = "json" | "text"

type BaseListOptions = { workspace?: string; extension?: string; apiKey?: string; format?: string; debug?: boolean }

type ListHostOptions = { ephemeral: boolean }

export function parseFormat(rawFormat: string | undefined): ListFormat {
	const format = (rawFormat ?? "json").toLowerCase()
	if (format === "json" || format === "text") {
		return format
	}
	throw new Error(`Invalid format: ${rawFormat}. Must be "json" or "text".`)
}

function resolveWorkspacePath(workspace: string | undefined): string {
	const resolved = workspace ? path.resolve(workspace) : process.cwd()
	if (!fs.existsSync(resolved)) {
		throw new Error(`Workspace path does not exist: ${resolved}`)
	}
	return resolved
}

function resolveExtensionPath(extension: string | undefined): string {
	const resolved = path.resolve(extension || getDefaultExtensionPath(__dirname))
	if (!fs.existsSync(path.join(resolved, "extension.js"))) {
		throw new Error(`Extension bundle not found at: ${resolved}`)
	}
	return resolved
}

async function createListHost(options: BaseListOptions, hostOptions: ListHostOptions): Promise<ExtensionHost> {
	const workspacePath = resolveWorkspacePath(options.workspace)
	const extensionPath = resolveExtensionPath(options.extension)
	const apiKey = options.apiKey || (await loadToken()) || getApiKeyFromEnv("jabberwock")

	const host = new ExtensionHost({
		mode: "code",
		reasoningEffort: undefined,
		user: null,
		provider: "jabberwock",
		model: getProviderDefaultModelId("jabberwock"),
		apiKey,
		workspacePath,
		extensionPath,
		nonInteractive: true,
		ephemeral: hostOptions.ephemeral,
		debug: options.debug ?? false,
		exitOnComplete: true,
		exitOnError: false,
		disableOutput: true,
	})

	await host.activate()
	await pWaitFor(() => host.client.isInitialized(), { interval: 25, timeout: 2_000 }).catch(() => undefined)

	return host
}

async function withHostAndSignalHandlers<T>(
	options: BaseListOptions,
	hostOptions: ListHostOptions,
	fn: (host: ExtensionHost) => Promise<T>,
): Promise<T> {
	const host = await createListHost(options, hostOptions)
	const shutdown = (exitCode: number) => host.dispose().then(() => process.exit(exitCode))
	const onSigint = () => void shutdown(130)
	const onSigterm = () => void shutdown(143)
	process.on("SIGINT", onSigint)
	process.on("SIGTERM", onSigterm)
	try {
		return await fn(host)
	} finally {
		process.off("SIGINT", onSigint)
		process.off("SIGTERM", onSigterm)
		await host.dispose()
	}
}

export async function listCommands(options: BaseListOptions): Promise<void> {
	const format = parseFormat(options.format)
	await withHostAndSignalHandlers(options, { ephemeral: true }, async (host) => {
		const commands = await requestCommands(host)
		if (format === "json") {
			outputJson({ commands })
			return
		}
		outputCommandsText(commands)
	})
}

export async function listModes(options: BaseListOptions): Promise<void> {
	const format = parseFormat(options.format)
	await withHostAndSignalHandlers(options, { ephemeral: true }, async (host) => {
		const modes = await requestModes(host)
		if (format === "json") {
			outputJson({ modes })
			return
		}
		outputModesText(modes)
	})
}

export async function listModels(options: BaseListOptions): Promise<void> {
	const format = parseFormat(options.format)
	await withHostAndSignalHandlers(options, { ephemeral: true }, async (host) => {
		const models = await requestRooModels(host)
		if (format === "json") {
			outputJson({ models })
			return
		}
		outputModelsText(models)
	})
}

export async function listSessions(options: BaseListOptions): Promise<void> {
	const format = parseFormat(options.format)
	const workspacePath = resolveWorkspacePath(options.workspace)
	const sessions = await readWorkspaceTaskSessions(workspacePath)
	if (format === "json") {
		outputJson({ workspace: workspacePath, sessions })
		return
	}
	outputSessionsText(sessions)
}
