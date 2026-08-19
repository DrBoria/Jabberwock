import { useEffect, useRef, useCallback, useMemo } from "react"
import { useApp } from "ink"
import { randomUUID } from "crypto"

import type { ExtensionMessage, WebviewMessage, HistoryItem } from "@jabberwock/types"
import type { ExtensionHostInterface } from "@/agent/index.js"

import { cliStore, useCLIStore } from "../../store.js"

import {
	extractTaskHistory,
	formatError,
	getOptionalString,
	handleSessionResume,
	waitForTaskHistory,
} from "./useExtensionHost.helpers.js"
import type { UseExtensionHostOptions, UseExtensionHostReturn } from "./useExtensionHost.types.js"

export type { UseExtensionHostOptions, UseExtensionHostReturn }

export function useExtensionHost({
	initialPrompt,
	initialTaskId,
	initialSessionId,
	continueSession,
	mode,
	reasoningEffort,
	user,
	provider,
	apiKey,
	model,
	workspacePath,
	extensionPath,
	nonInteractive,
	ephemeral,
	debug,
	exitOnComplete,
	onExtensionMessage,
	createExtensionHost,
}: UseExtensionHostOptions): UseExtensionHostReturn {
	const { exit } = useApp()
	const { addMessage } = useCLIStore()

	const hostRef = useRef<ExtensionHostInterface | null>(null)
	const isReadyRef = useRef(false)
	const pendingInitialTaskIdRef = useRef<string | undefined>(initialTaskId?.trim() || undefined)

	const cleanup = useCallback(async () => {
		if (hostRef.current) {
			await hostRef.current.dispose()
			hostRef.current = null
			isReadyRef.current = false
		}
	}, [])

	useEffect(() => {
		const init = async () => {
			try {
				const requestedSessionId = getOptionalString(initialSessionId)
				let taskHistorySnapshot: HistoryItem[] = []

				const host = createExtensionHost({
					mode,
					user,
					reasoningEffort,
					provider,
					apiKey,
					model,
					workspacePath,
					extensionPath,
					nonInteractive,
					ephemeral,
					debug,
					exitOnComplete,
					disableOutput: true,
				})

				hostRef.current = host
				isReadyRef.current = true

				host.on("extensionWebviewMessage", (msg) => {
					const extensionMessage = msg as ExtensionMessage
					const taskHistory = extractTaskHistory(extensionMessage)
					if (taskHistory) {
						taskHistorySnapshot = taskHistory
					}
					onExtensionMessage(extensionMessage)
				})

				host.client.on("taskCompleted", async () => {
					cliStore.isComplete = true
					cliStore.isLoading = false
					if (exitOnComplete) {
						await cleanup()
						exit()
						setTimeout(() => process.exit(0), 100)
					}
				})

				host.client.on("error", (err: Error) => {
					cliStore.error = err.message
					cliStore.isLoading = false
				})

				await host.activate()
				host.sendToExtension({ type: "requestCommands" })
				host.sendToExtension({ type: "requestModes" })
				await waitForTaskHistory(() => (taskHistorySnapshot as unknown[]).length > 0)

				const resumed = await handleSessionResume(
					requestedSessionId,
					continueSession,
					taskHistorySnapshot,
					workspacePath,
					host,
					(id: string) => {
						cliStore.currentTaskId = id
					},
					(value: boolean) => {
						cliStore.isResumingTask = value
					},
					(value: boolean) => {
						cliStore.hasStartedTask = value
					},
					(value: boolean) => {
						cliStore.isLoading = value
					},
				)
				if (resumed) {
					return
				}

				cliStore.isLoading = false
				if (initialPrompt) {
					cliStore.hasStartedTask = true
					cliStore.isLoading = true
					addMessage({ id: randomUUID(), role: "user", content: initialPrompt })
					const taskId = pendingInitialTaskIdRef.current
					pendingInitialTaskIdRef.current = undefined
					await host.runTask(initialPrompt, taskId)
				}
			} catch (err) {
				cliStore.error = formatError(err)
				cliStore.isLoading = false
			}
		}

		init()
		return () => {
			cleanup()
		}
	}, [])

	const sendToExtension = useCallback((msg: WebviewMessage) => {
		hostRef.current?.sendToExtension(msg)
	}, [])

	const runTask = useCallback((prompt: string): Promise<void> => {
		if (!hostRef.current) {
			return Promise.reject(new Error("Extension host not ready"))
		}
		const taskId = pendingInitialTaskIdRef.current
		pendingInitialTaskIdRef.current = undefined
		return hostRef.current.runTask(prompt, taskId)
	}, [])

	return useMemo(
		() => ({ isReady: isReadyRef.current, sendToExtension, runTask, cleanup }),
		[sendToExtension, runTask, cleanup],
	)
}
