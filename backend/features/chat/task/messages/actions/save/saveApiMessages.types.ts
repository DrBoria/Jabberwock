import { Anthropic } from "@anthropic-ai/sdk"

export type ApiMessage = Anthropic.MessageParam & {
	ts?: number
	isSummary?: boolean
	id?: string
	type?: "reasoning"
	summary?: Anthropic.Messages.ContentBlockParam[]
	encrypted_content?: string
	text?: string
	reasoning_details?: { [key: string]: unknown }[]
	reasoning_content?: string
	condenseId?: string
	condenseParent?: string
	truncationId?: string
	truncationParent?: string
	isTruncationMarker?: boolean
}

/** Reasoning blocks stored in API messages use non-standard fields beyond ContentBlockParam */
export interface ReasoningBlockFields {
	type: string
	encrypted_content?: string
	summary?: Anthropic.Messages.ContentBlockParam[]
	text?: string
	id?: string
}

export type ReasoningItemForRequest = {
	type: "reasoning"
	encrypted_content: string
	id?: string
	summary?: Anthropic.Messages.ContentBlockParam[]
}
