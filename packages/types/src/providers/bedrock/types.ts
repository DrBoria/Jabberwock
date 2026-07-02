// https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference.html

import { bedrockModels } from "./models.ts"

export type BedrockModelId = keyof typeof bedrockModels

export const bedrockDefaultModelId: BedrockModelId = "anthropic.claude-sonnet-4-5-20250929-v1:0"

export const bedrockDefaultPromptRouterModelId: BedrockModelId = "anthropic.claude-3-sonnet-20240229-v1:0"

export { bedrockModels }

export const BEDROCK_DEFAULT_TEMPERATURE = 0.3

export const BEDROCK_MAX_TOKENS = 4096

export const BEDROCK_DEFAULT_CONTEXT = 128_000

// Amazon Bedrock Inference Profile mapping based on official documentation
// https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-support.html
// This mapping is pre-ordered by pattern length (descending) to ensure more specific patterns match first
export const AWS_INFERENCE_PROFILE_MAPPING: Array<[string, string]> = [
	// Australia regions (Sydney and Melbourne) → au. inference profile (most specific - 14 chars)
	["ap-southeast-2", "au."],
	["ap-southeast-4", "au."],
	// Japan regions (Tokyo and Osaka) → jp. inference profile (13 chars)
	["ap-northeast-", "jp."],
	// US Government Cloud → ug. inference profile (7 chars)
	["us-gov-", "ug."],
	// Americas regions → us. inference profile (3 chars)
	["us-", "us."],
	// Europe regions → eu. inference profile (3 chars)
	["eu-", "eu."],
	// Asia Pacific regions → apac. inference profile (3 chars)
	["ap-", "apac."],
	// Canada regions → ca. inference profile (3 chars)
	["ca-", "ca."],
	// South America regions → sa. inference profile (3 chars)
	["sa-", "sa."],
]

// Amazon Bedrock supported regions for the regions dropdown
// Based on official AWS documentation
export const BEDROCK_REGIONS = [
	{ value: "us-east-1", label: "us-east-1" },
	{ value: "us-east-2", label: "us-east-2" },
	{ value: "us-west-1", label: "us-west-1" },
	{ value: "us-west-2", label: "us-west-2" },
	{ value: "ap-northeast-1", label: "ap-northeast-1" },
	{ value: "ap-northeast-2", label: "ap-northeast-2" },
	{ value: "ap-northeast-3", label: "ap-northeast-3" },
	{ value: "ap-south-1", label: "ap-south-1" },
	{ value: "ap-south-2", label: "ap-south-2" },
	{ value: "ap-southeast-1", label: "ap-southeast-1" },
	{ value: "ap-southeast-2", label: "ap-southeast-2" },
	{ value: "ap-east-1", label: "ap-east-1" },
	{ value: "eu-central-1", label: "eu-central-1" },
	{ value: "eu-central-2", label: "eu-central-2" },
	{ value: "eu-west-1", label: "eu-west-1" },
	{ value: "eu-west-2", label: "eu-west-2" },
	{ value: "eu-west-3", label: "eu-west-3" },
	{ value: "eu-north-1", label: "eu-north-1" },
	{ value: "eu-south-1", label: "eu-south-1" },
	{ value: "eu-south-2", label: "eu-south-2" },
	{ value: "ca-central-1", label: "ca-central-1" },
	{ value: "sa-east-1", label: "sa-east-1" },
	{ value: "us-gov-east-1", label: "us-gov-east-1" },
	{ value: "us-gov-west-1", label: "us-gov-west-1" },
].sort((a, b) => a.value.localeCompare(b.value))

export const BEDROCK_1M_CONTEXT_MODEL_IDS = [
	"anthropic.claude-sonnet-4-20250514-v1:0",
	"anthropic.claude-sonnet-4-5-20250929-v1:0",
	"anthropic.claude-sonnet-4-6",
	"anthropic.claude-opus-4-6-v1",
] as const

// Amazon Bedrock models that support Global Inference profiles
// As of Nov 2025, AWS supports Global Inference for:
// - Claude Sonnet 4
// - Claude Sonnet 4.5
// - Claude Sonnet 4.6
// - Claude Haiku 4.5
// - Claude Opus 4.5
// - Claude Opus 4.6
export const BEDROCK_GLOBAL_INFERENCE_MODEL_IDS = [
	"anthropic.claude-sonnet-4-20250514-v1:0",
	"anthropic.claude-sonnet-4-5-20250929-v1:0",
	"anthropic.claude-sonnet-4-6",
	"anthropic.claude-haiku-4-5-20251001-v1:0",
	"anthropic.claude-opus-4-5-20251101-v1:0",
	"anthropic.claude-opus-4-6-v1",
] as const

// Amazon Bedrock Service Tier types
export type BedrockServiceTier = "STANDARD" | "FLEX" | "PRIORITY"

// Models that support service tiers based on AWS documentation
// https://docs.aws.amazon.com/bedrock/latest/userguide/service-tiers-inference.html
export const BEDROCK_SERVICE_TIER_MODEL_IDS = [
	// Amazon Nova models
	"amazon.nova-lite-v1:0",
	"amazon.nova-2-lite-v1:0",
	"amazon.nova-pro-v1:0",
	"amazon.nova-pro-latency-optimized-v1:0",
	// DeepSeek models
	"deepseek.r1-v1:0",
	// Qwen models
	"qwen.qwen3-next-80b-a3b",
	"qwen.qwen3-coder-480b-a35b-v1:0",
	// OpenAI GPT-OSS models
	"openai.gpt-oss-20b-1:0",
	"openai.gpt-oss-120b-1:0",
] as const

// Service tier pricing multipliers
export const BEDROCK_SERVICE_TIER_PRICING = {
	STANDARD: 1.0, // Base price
	FLEX: 0.5, // 50% discount from standard
	PRIORITY: 1.75, // 75% premium over standard
} as const
