/**
 * Set of format values supported by OpenAI's Structured Outputs (strict mode).
 * Unsupported format values will be stripped during schema normalization.
 * @see https://platform.openai.com/docs/guides/structured-outputs#supported-schemas
 */
export const OPENAI_SUPPORTED_FORMATS = new Set([
	"date-time",
	"time",
	"date",
	"duration",
	"email",
	"hostname",
	"ipv4",
	"ipv6",
	"uuid",
])

/**
 * Array-specific JSON Schema properties that must be nested inside array type variants
 * when converting to anyOf format (JSON Schema draft 2020-12).
 */
export const ARRAY_SPECIFIC_PROPERTIES = ["items", "minItems", "maxItems", "uniqueItems"] as const

/**
 * Applies array-specific properties from source to target object.
 * Only copies properties that are defined in the source.
 */
export function applyArrayProperties(
	target: Record<string, unknown>,
	source: Record<string, unknown>,
): Record<string, unknown> {
	for (const prop of ARRAY_SPECIFIC_PROPERTIES) {
		if (source[prop] !== undefined) {
			target[prop] = source[prop]
		}
	}
	return target
}

export function checkIsObjectType(type: unknown, properties: unknown): boolean {
	if (type === "object") {
		return true
	}
	if (Array.isArray(type) && type.includes("object")) {
		return true
	}
	if (properties !== undefined) {
		return true
	}
	return false
}

export function handleTypeField(
	result: Record<string, unknown>,
	type: unknown,
	arrayProps: Record<string, unknown>,
): void {
	if (Array.isArray(type)) {
		result.anyOf = type.map((t) => {
			if (t === "array") {
				return applyArrayProperties({ type: t }, arrayProps)
			}
			return { type: t }
		})
	} else if (type !== undefined) {
		result.type = type
		if (type === "array") {
			applyArrayProperties(result, arrayProps)
		}
	}
}

export function handleFormatField(result: Record<string, unknown>, format: unknown): void {
	if (format && OPENAI_SUPPORTED_FORMATS.has(format as string)) {
		result.format = format
	}
}

export function handlePropertiesField(
	result: Record<string, unknown>,
	type: unknown,
	properties: unknown,
	required: unknown,
): void {
	if (properties && typeof properties === "object") {
		result.properties = properties
		if (Array.isArray(required)) {
			const propertyKeys = Object.keys(properties as Record<string, unknown>)
			const filteredRequired = required.filter((key) => propertyKeys.includes(key))
			if (filteredRequired.length > 0) {
				result.required = filteredRequired
			}
		}
	} else if (result.type === "object" || (Array.isArray(type) && type.includes("object"))) {
		result.properties = {}
	}
}

export function handleAdditionalPropertiesField(
	result: Record<string, unknown>,
	type: unknown,
	isObjectType: boolean,
): void {
	if (isObjectType) {
		result.additionalProperties = false
	}
}

export function normalizeJsonSchema(schema: Record<string, unknown>): Record<string, unknown> {
	const {
		type,
		required,
		properties,
		additionalProperties: _additionalProperties,
		format,
		items,
		minItems,
		maxItems,
		uniqueItems,
		...rest
	} = schema
	const result: Record<string, unknown> = { ...rest }

	const isObjectType = checkIsObjectType(type, properties)
	const arrayProps = { items, minItems, maxItems, uniqueItems }

	handleTypeField(result, type, arrayProps)
	handleFormatField(result, format)
	handlePropertiesField(result, type, properties, required)
	handleAdditionalPropertiesField(result, type, isObjectType)

	return result
}

export function findObjectVariant(variants: Record<string, unknown>[]): Record<string, unknown> | undefined {
	return variants.find(
		(variant) =>
			typeof variant === "object" &&
			variant !== null &&
			(variant.type === "object" || variant.properties !== undefined),
	)
}

export function getCompositionArray(schema: Record<string, unknown>): Record<string, unknown>[] | undefined {
	const { anyOf, oneOf, allOf } = schema
	const composition = anyOf || oneOf || allOf
	if (!composition || !Array.isArray(composition) || composition.length === 0) {
		return undefined
	}
	return composition as Record<string, unknown>[]
}

/**
 * Flattens top-level composition keywords (anyOf/oneOf/allOf) by merging
 * the first object variant's properties into the parent schema.
 * Required by some API providers (e.g., OpenRouter/Claude) which don't support
 * schema composition keywords at the top level.
 */
export function flattenTopLevelComposition(schema: Record<string, unknown>): Record<string, unknown> {
	const composition = getCompositionArray(schema)
	if (!composition) {
		return { ...schema }
	}

	const objectVariant = findObjectVariant(composition)
	if (!objectVariant) {
		return { ...schema }
	}

	const { anyOf: _anyOf, oneOf: _oneOf, allOf: _allOf, ...rest } = schema
	const { properties, required, type, ...variantRest } = objectVariant

	const flattened: Record<string, unknown> = { ...rest, ...variantRest }

	if (type !== undefined) {
		flattened.type = type
	}

	if (properties !== undefined) {
		flattened.properties = properties
	}

	if (required !== undefined) {
		flattened.required = required
	}

	return flattened
}
