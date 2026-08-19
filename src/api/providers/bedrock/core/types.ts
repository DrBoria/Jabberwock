import type { Message, SystemContentBlock, ToolConfiguration } from "@aws-sdk/client-bedrock-runtime"
import type { ModelInfo, BedrockModelId, BedrockServiceTier } from "@jabberwock/types"

// Define interface for Bedrock inference config
export interface BedrockInferenceConfig {
	maxTokens: number
	temperature?: number
}

// Define interface for Bedrock additional model request fields
// This includes thinking configuration, 1M context beta, and other model-specific parameters
export interface BedrockAdditionalModelFields {
	thinking?: {
		type: "enabled"
		budget_tokens: number
	}
	anthropic_beta?: string[]
	[key: string]: unknown // Add index signature to be compatible with DocumentType
}

// Define interface for Bedrock payload
export interface BedrockPayload {
	modelId: BedrockModelId | string
	messages: Message[]
	system?: SystemContentBlock[]
	inferenceConfig: BedrockInferenceConfig
	anthropic_version?: string
	additionalModelRequestFields?: BedrockAdditionalModelFields
	toolConfig?: ToolConfiguration
}

// Extended payload type that includes service_tier as a top-level parameter
// AWS Bedrock service tiers (STANDARD, FLEX, PRIORITY) are specified at the top level
// https://docs.aws.amazon.com/bedrock/latest/userguide/service-tiers-inference.html
export type BedrockPayloadWithServiceTier = BedrockPayload & {
	service_tier?: BedrockServiceTier
}

// Define specific types for content block events to avoid 'as any' usage
// These handle the multiple possible structures returned by AWS SDK
export interface ContentBlockStartEvent {
	start?: {
		text?: string
		thinking?: string
		toolUse?: {
			toolUseId?: string
			name?: string
		}
	}
	contentBlockIndex?: number
	// Alternative structure used by some AWS SDK versions
	content_block?: {
		type?: string
		thinking?: string
	}
	// Official AWS SDK structure for reasoning (as documented)
	contentBlock?: {
		type?: string
		thinking?: string
		reasoningContent?: {
			text?: string
		}
		// Tool use block start
		toolUse?: {
			toolUseId?: string
			name?: string
		}
	}
}

export interface ContentBlockDeltaEvent {
	delta?: {
		text?: string
		thinking?: string
		type?: string
		// AWS SDK structure for reasoning content deltas
		reasoningContent?: {
			text?: string
		}
		// Tool use input delta
		toolUse?: {
			input?: string
		}
	}
	contentBlockIndex?: number
}

// Define types for stream events based on AWS SDK
export interface StreamEvent {
	messageStart?: {
		role?: string
	}
	messageStop?: {
		stopReason?: "end_turn" | "tool_use" | "max_tokens" | "stop_sequence"
		additionalModelResponseFields?: Record<string, unknown>
	}
	contentBlockStart?: ContentBlockStartEvent
	contentBlockDelta?: ContentBlockDeltaEvent
	metadata?: {
		usage?: {
			inputTokens: number
			outputTokens: number
			totalTokens?: number
			// New cache-related fields
			cacheReadInputTokens?: number
			cacheWriteInputTokens?: number
			cacheReadInputTokenCount?: number
			cacheWriteInputTokenCount?: number
		}
		metrics?: {
			latencyMs: number
		}
	}
	// New trace field for prompt router
	trace?: {
		promptRouter?: {
			invokedModelId?: string
			usage?: {
				inputTokens: number
				outputTokens: number
				totalTokens?: number
				// New cache-related fields
				cacheReadTokens?: number
				cacheWriteTokens?: number
				cacheReadInputTokenCount?: number
				cacheWriteInputTokenCount?: number
			}
		}
	}
}

// Type for usage information in stream events
export type UsageType = {
	inputTokens?: number
	outputTokens?: number
	cacheReadInputTokens?: number
	cacheWriteInputTokens?: number
	cacheReadInputTokenCount?: number
	cacheWriteInputTokenCount?: number
}

// Metadata that may be present on Bedrock SDK errors (status, $metadata)
export interface BedrockErrorMetadata {
	status?: number
	$metadata?: { httpStatusCode?: number }
	name?: string
	__type?: string
}

// Extended ModelInfo with optional cachableFields for AWS prompt cache
export interface ModelInfoWithCacheFields extends ModelInfo {
	cachableFields?: string[]
}
