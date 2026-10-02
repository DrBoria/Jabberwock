/**
 * Neutral, provider-agnostic content-block types for the app layer.
 *
 * The app layer (actions / handlers / events) must NOT depend on any AI
 * provider SDK (Anthropic / OpenAI / Ollama / …). These structural types
 * mirror the wire-format content blocks the providers speak, so the app layer
 * can read and transform user content without importing a provider SDK.
 *
 * The **api boundary** (`backend/features/api/**`) is the single sanctioned
 * place that maps these neutral blocks to a specific provider's wire format.
 *
 * The shapes are deliberately kept structurally identical to the Anthropic
 * `Messages.*BlockParam` interfaces so the api boundary can cast between the
 * two without loss.
 */

// ── Cache control ────────────────────────────────────────────────────────────
export interface CacheControlEphemeral {
	type: "ephemeral"
}

// ── Citations ────────────────────────────────────────────────────────────────
export interface CitationCharLocationParam {
	cited_text: string
	document_index: number
	document_title: string | null
	end_char_index: number
	start_char_index: number
	type: "char_location"
}

export interface CitationPageLocationParam {
	cited_text: string
	document_index: number
	document_title: string | null
	end_page_number: number
	start_page_number: number
	type: "page_location"
}

export interface CitationContentBlockLocationParam {
	cited_text: string
	document_index: number
	document_title: string | null
	end_block_index: number
	start_block_index: number
	type: "content_block_location"
}

export type TextCitationParam =
	| CitationCharLocationParam
	| CitationPageLocationParam
	| CitationContentBlockLocationParam

export interface CitationsConfigParam {
	enabled?: boolean
}

// ── Document sources ─────────────────────────────────────────────────────────
export interface Base64PDFSource {
	data: string
	media_type: "application/pdf"
	type: "base64"
}

export interface PlainTextSource {
	data: string
	media_type: "text/plain"
	type: "text"
}

export type ContentBlockSourceContent = TextBlockParam | ImageBlockParam

export interface ContentBlockSource {
	content: string | Array<ContentBlockSourceContent>
	type: "content"
}

// ── Content blocks ───────────────────────────────────────────────────────────
export interface TextBlockParam {
	text: string
	type: "text"
	cache_control?: CacheControlEphemeral | null
	citations?: Array<TextCitationParam> | null
}

export interface ImageBlockParam {
	source: {
		data: string
		media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp"
		type: "base64"
	}
	type: "image"
	cache_control?: CacheControlEphemeral | null
}

export interface ToolUseBlockParam {
	id: string
	input: unknown
	name: string
	type: "tool_use"
	cache_control?: CacheControlEphemeral | null
}

export interface ToolResultBlockParam {
	tool_use_id: string
	type: "tool_result"
	cache_control?: CacheControlEphemeral | null
	content?: string | Array<TextBlockParam | ImageBlockParam>
	is_error?: boolean
}

export interface DocumentBlockParam {
	source: Base64PDFSource | PlainTextSource | ContentBlockSource
	type: "document"
	cache_control?: CacheControlEphemeral | null
	citations?: CitationsConfigParam
	context?: string | null
	title?: string | null
}

export interface ThinkingBlockParam {
	signature: string
	thinking: string
	type: "thinking"
}

export interface RedactedThinkingBlockParam {
	data: string
	type: "redacted_thinking"
}

/**
 * The full neutral content-block union — structurally identical to the
 * Anthropic `Messages.ContentBlockParam`.
 */
export type ContentBlockParam =
	| TextBlockParam
	| ImageBlockParam
	| ToolUseBlockParam
	| ToolResultBlockParam
	| DocumentBlockParam
	| ThinkingBlockParam
	| RedactedThinkingBlockParam
