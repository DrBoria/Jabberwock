import type { ApiHandler, ApiHandlerCreateMessageMetadata } from "@api"
import type { ApiMessage } from "@features/chat/task/messages/actions/save/saveApiMessages.types"

export type SummarizeResponse = {
	messages: ApiMessage[]
	summary: string
	cost: number
	newContextTokens?: number
	error?: string
	errorDetails?: string
	condenseId?: string
}

export type SummarizeConversationOptions = {
	messages: ApiMessage[]
	apiHandler: ApiHandler
	systemPrompt: string
	taskId: string
	isAutomaticTrigger?: boolean
	customCondensingPrompt?: string
	metadata?: ApiHandlerCreateMessageMetadata
	environmentDetails?: string
	filesReadByJabberwock?: string[]
	cwd?: string
	jabberwockIgnoreController?: string
}
