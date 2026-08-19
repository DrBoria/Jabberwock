import { Anthropic } from "@anthropic-ai/sdk"
import * as vscode from "vscode"
import { type ModelInfo } from "@jabberwock/types"
import type { ApiHandlerOptions } from "@shared/api"
import { ApiStream } from "@api/transform/stream"
import { convertToVsCodeLmMessages } from "@api/transform/format/vscode-lm-format"
import { BaseProvider } from "@api/providers/base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "@api/index"
import { convertToVsCodeLmTools, buildModelInfo } from "./tools"
import { processVscodeLmStream, handleVscodeLmStreamError } from "./stream"
import { internalCountTokens, calculateTotalInputTokens, cleanMessageContent } from "./token-count"

/**
 * Handles interaction with VS Code's Language Model API for chat-based operations.
 */
export class VsCodeLmHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: vscode.LanguageModelChat | null
	private disposable: vscode.Disposable | null
	private currentRequestCancellation: vscode.CancellationTokenSource | null

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
		this.client = null
		this.disposable = null
		this.currentRequestCancellation = null
		try {
			this.disposable = vscode.workspace.onDidChangeConfiguration((event) => {
				if (event.affectsConfiguration("lm")) {
					try {
						this.client = null
						this.ensureCleanState()
					} catch (error) {
						console.error("[jabberwock] Error during configuration change cleanup:", error)
					}
				}
			})
			this.initializeClient()
		} catch (error) {
			this.dispose()
			throw new Error(
				`Jabberwock <Language Model API>: Failed to initialize handler: ${error instanceof Error ? error.message : "Unknown error"}`,
			)
		}
	}
	async initializeClient(): Promise<void> {
		try {
			if (this.client) {
				console.debug("Jabberwock <Language Model API>: Client already initialized")
				return
			}
			this.client = await this.createClient(this.options.vsCodeLmModelSelector || {})
			console.debug("Jabberwock <Language Model API>: Client initialized successfully")
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error"
			console.error("[jabberwock] Jabberwock <Language Model API>: Client initialization failed:", errorMessage)
			throw new Error(`Jabberwock <Language Model API>: Failed to initialize client: ${errorMessage}`)
		}
	}
	async createClient(selector: vscode.LanguageModelChatSelector): Promise<vscode.LanguageModelChat> {
		try {
			const models = await vscode.lm.selectChatModels(selector)
			if (models && Array.isArray(models) && models.length > 0) {
				return models[0]
			}
			return {
				id: "default-lm",
				name: "Default Language Model",
				vendor: "vscode",
				family: "lm",
				version: "1.0",
				maxInputTokens: 8192,
				sendRequest: async (_messages, _options, _token) => ({
					stream: (async function* () {
						yield new vscode.LanguageModelTextPart(
							"Language model functionality is limited. Please check VS Code configuration.",
						)
					})(),
					text: (async function* () {
						yield "Language model functionality is limited. Please check VS Code configuration."
					})(),
				}),
				countTokens: async () => 0,
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error"
			throw new Error(`Jabberwock <Language Model API>: Failed to select model: ${errorMessage}`)
		}
	}
	dispose(): void {
		if (this.disposable) {
			this.disposable.dispose()
		}
		if (this.currentRequestCancellation) {
			this.currentRequestCancellation.cancel()
			this.currentRequestCancellation.dispose()
		}
	}
	override async countTokens(content: Array<Anthropic.Messages.ContentBlockParam>): Promise<number> {
		let textContent = ""
		for (const block of content) {
			if (block.type === "text") {
				textContent += block.text || ""
			} else if (block.type === "image") {
				textContent += "[IMAGE]"
			}
		}
		return internalCountTokens(this.client, textContent, this.currentRequestCancellation)
	}
	private ensureCleanState(): void {
		if (this.currentRequestCancellation) {
			this.currentRequestCancellation.cancel()
			this.currentRequestCancellation.dispose()
			this.currentRequestCancellation = null
		}
	}
	private async getClient(): Promise<vscode.LanguageModelChat> {
		if (!this.client) {
			try {
				const selector = this.options?.vsCodeLmModelSelector || {}
				this.client = await this.createClient(selector)
			} catch (error) {
				const message = error instanceof Error ? error.message : "Unknown error"
				throw new Error(`Jabberwock <Language Model API>: Failed to create client: ${message}`)
			}
		}
		return this.client
	}
	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		this.ensureCleanState()
		const client = await this.getClient()
		const cleanedMessages = messages.map((msg) => ({
			...msg,
			content: cleanMessageContent(msg.content),
		})) as Anthropic.Messages.MessageParam[]
		const vsCodeLmMessages: vscode.LanguageModelChatMessage[] = [
			vscode.LanguageModelChatMessage.Assistant(systemPrompt),
			...convertToVsCodeLmMessages(cleanedMessages),
		]
		this.currentRequestCancellation = new vscode.CancellationTokenSource()
		const totalInputTokens = await calculateTotalInputTokens(
			this.client,
			vsCodeLmMessages,
			this.currentRequestCancellation,
		)
		try {
			const requestOptions: vscode.LanguageModelChatRequestOptions = {
				justification: `Jabberwock would like to use '${client.name}' from '${client.vendor}', Click 'Allow' to proceed.`,
				tools: convertToVsCodeLmTools(metadata?.tools ?? []),
			}
			const response = await client.sendRequest(
				vsCodeLmMessages,
				requestOptions,
				this.currentRequestCancellation.token,
			)
			const accumulatedText = yield* processVscodeLmStream(response, metadata)
			const totalOutputTokens = await internalCountTokens(
				this.client,
				accumulatedText,
				this.currentRequestCancellation,
			)
			yield { type: "usage", inputTokens: totalInputTokens, outputTokens: totalOutputTokens }
		} catch (error: unknown) {
			this.ensureCleanState()
			handleVscodeLmStreamError(error)
		}
	}
	override getModel(): { id: string; info: ModelInfo } {
		return buildModelInfo(this.client, this.options)
	}
	async completePrompt(prompt: string): Promise<string> {
		try {
			const client = await this.getClient()
			const response = await client.sendRequest(
				[vscode.LanguageModelChatMessage.User(prompt)],
				{},
				new vscode.CancellationTokenSource().token,
			)
			let result = ""
			for await (const chunk of response.stream) {
				if (chunk instanceof vscode.LanguageModelTextPart) {
					result += chunk.value
				}
			}
			return result
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`VSCode LM completion error: ${error.message}`)
			}
			throw error
		}
	}
}
