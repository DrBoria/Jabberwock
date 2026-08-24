import type { z as z4 } from "zod/v4"
import { z } from "zod"
import { normalizeJsonSchema, flattenTopLevelComposition } from "./schema-helpers"

/**
 * Re-export Zod v4's JSONSchema type for convenience
 */
export type JsonSchema = z4.core.JSONSchema.JSONSchema

/**
 * Zod schema for JSON Schema primitive types
 */
export const JsonSchemaPrimitiveTypeSchema = z.enum(["string", "number", "integer", "boolean", "null"])

/**
 * All valid JSON Schema type values including object and array
 */
export const JsonSchemaTypeSchema = z.union([JsonSchemaPrimitiveTypeSchema, z.literal("object"), z.literal("array")])

/**
 * Zod schema for JSON Schema enum values
 */
export const JsonSchemaEnumValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])

/**
 * Zod schema that validates tool input JSON Schema and sets `additionalProperties: false` by default.
 * Uses recursive parsing so the default applies to all nested schemas automatically.
 *
 * This is required by some API providers (e.g., OpenAI) for strict function calling.
 */
export const ToolInputSchema: z.ZodType<JsonSchema> = z.lazy(() =>
	z
		.object({
			type: JsonSchemaTypeSchema.optional(),
			properties: z.record(z.string(), ToolInputSchema).optional(),
			items: z.union([ToolInputSchema, z.array(ToolInputSchema)]).optional(),
			required: z.array(z.string()).optional(),
			additionalProperties: z.union([z.boolean(), ToolInputSchema]).default(false),
			description: z.string().optional(),
			default: z.unknown().optional(),
			enum: z.array(JsonSchemaEnumValueSchema).optional(),
			const: JsonSchemaEnumValueSchema.optional(),
			anyOf: z.array(ToolInputSchema).optional(),
			oneOf: z.array(ToolInputSchema).optional(),
			allOf: z.array(ToolInputSchema).optional(),
			$ref: z.string().optional(),
			minimum: z.number().optional(),
			maximum: z.number().optional(),
			minLength: z.number().optional(),
			maxLength: z.number().optional(),
			pattern: z.string().optional(),
			minItems: z.number().optional(),
			maxItems: z.number().optional(),
			uniqueItems: z.boolean().optional(),
		})
		.passthrough(),
)

/**
 * Schema for type field that accepts both single types and array types (draft-07 nullable syntax).
 * Array types like ["string", "null"] are transformed to anyOf format for 2020-12 compliance.
 */
const TypeFieldSchema = z.union([JsonSchemaTypeSchema, z.array(JsonSchemaTypeSchema)])

/**
 * Internal Zod schema that normalizes tool input JSON Schema to be compliant with JSON Schema draft 2020-12.
 *
 * This schema performs three key transformations:
 * 1. Sets `additionalProperties: false` by default (required by OpenAI strict mode)
 * 2. Converts deprecated `type: ["T", "null"]` array syntax to `anyOf` format
 *    (required by Claude on Bedrock which enforces JSON Schema draft 2020-12)
 * 3. Strips unsupported `format` values (e.g., "uri") for OpenAI Structured Outputs compatibility
 */
const NormalizedToolSchemaInternal: z.ZodType<Record<string, unknown>, z.ZodTypeDef, Record<string, unknown>> = z.lazy(
	() =>
		z
			.object({
				type: TypeFieldSchema.optional(),
				properties: z.record(z.string(), NormalizedToolSchemaInternal).optional(),
				items: z.union([NormalizedToolSchemaInternal, z.array(NormalizedToolSchemaInternal)]).optional(),
				required: z.array(z.string()).optional(),
				additionalProperties: z.union([z.boolean(), NormalizedToolSchemaInternal]).optional(),
				description: z.string().optional(),
				default: z.unknown().optional(),
				enum: z.array(JsonSchemaEnumValueSchema).optional(),
				const: JsonSchemaEnumValueSchema.optional(),
				anyOf: z.array(NormalizedToolSchemaInternal).optional(),
				oneOf: z.array(NormalizedToolSchemaInternal).optional(),
				allOf: z.array(NormalizedToolSchemaInternal).optional(),
				$ref: z.string().optional(),
				minimum: z.number().optional(),
				maximum: z.number().optional(),
				minLength: z.number().optional(),
				maxLength: z.number().optional(),
				pattern: z.string().optional(),
				minItems: z.number().optional(),
				maxItems: z.number().optional(),
				uniqueItems: z.boolean().optional(),
				format: z.string().optional(),
			})
			.passthrough()
			.transform((schema) => normalizeJsonSchema(schema)),
)

/**
 * Normalizes a tool input JSON Schema to be compliant with JSON Schema draft 2020-12.
 *
 * This function performs four key transformations:
 * 1. Sets `additionalProperties: false` by default (required by OpenAI strict mode)
 * 2. Converts deprecated `type: ["T", "null"]` array syntax to `anyOf` format
 *    (required by Claude on Bedrock which enforces JSON Schema draft 2020-12)
 * 3. Strips unsupported `format` values (e.g., "uri") for OpenAI Structured Outputs compatibility
 * 4. Flattens top-level anyOf/oneOf/allOf (required by OpenRouter/Claude which don't support
 *    schema composition keywords at the top level)
 *
 * @param schema - The JSON Schema to normalize
 * @returns A normalized schema object that is JSON Schema draft 2020-12 compliant
 */
export function normalizeToolSchema(schema: Record<string, unknown>): Record<string, unknown> {
	if (typeof schema !== "object" || schema === null) {
		return schema
	}

	// First, flatten any top-level composition keywords before normalizing
	const flattenedSchema = flattenTopLevelComposition(schema)

	const result = NormalizedToolSchemaInternal.safeParse(flattenedSchema)
	return result.success ? result.data : flattenedSchema
}
