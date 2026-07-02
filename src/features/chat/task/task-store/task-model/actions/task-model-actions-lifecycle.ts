import { buildApiHandler } from "@api/index"
import type { TokenUsage, ToolUsage } from "@jabberwock/types"
import type { ProviderSettings } from "@jabberwock/types"
import type { AskResponseValue } from "@jabberwock/types"
import debounce from "lodash.debounce"
import { TaskModelWithViews } from "@features/chat/task/task-store/task-model/views"

// Step 1: setTokenUsageSnapshot (must be first for afterCreate to find it)
export const TaskModelWithTokenUsage = TaskModelWithViews.actions((self) => ({
	setTokenUsageSnapshot(tokenUsage: TokenUsage, toolUsage?: ToolUsage) {
		self.tokenUsageSnapshot = tokenUsage
		if (toolUsage !== undefined) {
			self.toolUsage = toolUsage
		}
	},
}))

// Step 2: Lifecycle hooks + core task interface methods
export const TaskModelWithLifecycle = TaskModelWithTokenUsage.actions((self) => ({
	afterCreate() {
		self.api = buildApiHandler(self.apiConfiguration)
		self.debouncedEmitTokenUsage = debounce((tokenUsage: TokenUsage, toolUsage: ToolUsage) => {
			self.setTokenUsageSnapshot(tokenUsage, toolUsage)
		}, 500)
	},
	beforeDestroy() {
		;(self.api as { abort?: () => void } | undefined)?.abort?.()
		self.abortController?.abort()
		self.debouncedEmitTokenUsage?.cancel()
	},

	cancelCurrentRequest(): void {
		self.abort = true
		self.abortController?.abort()
	},

	submitUserMessage(text: string, images?: string[]): Promise<void> {
		const trimmedText = text?.trim()
		if (!trimmedText && (!images || images.length === 0)) {
			return Promise.resolve()
		}
		if (self.askResolve) {
			self.askResolve({
				response: "messageResponse" as AskResponseValue,
				text: trimmedText || "",
				images,
			})
			self.askResolve = null
		}
		return Promise.resolve()
	},
	abortTask(): void {
		self.abort = true
		self.abortController?.abort()
	},
	updateApiConfiguration(profile: unknown): void {
		const config = profile as ProviderSettings
		self.apiConfiguration = config
		self.api = buildApiHandler(config)
	},
	getTaskMode(): Promise<string | undefined> {
		return Promise.resolve(self._taskMode)
	},
	handleTerminalOperation(operation: unknown): void {
		const tp = self.terminalProcess
		if (operation === "continue") {
			tp?.continue()
		} else if (operation === "abort") {
			tp?.abort()
		}
	},
}))
