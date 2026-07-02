/**
 * Shared utilities for processing tool call schemas.
 *
 * These functions ensure tool call parameter schemas conform to
 * OpenAI's strict mode requirements:
 * - `ensureAllRequired` — marks every property as required
 * - `ensureAdditionalPropertiesFalse` — sets additionalProperties: false on every object
 */

function isObjectSchema(schema: Record<string, unknown>): boolean {
	return !!schema && typeof schema === "object" && schema.type === "object"
}

function isArrayOfObjects(prop: Record<string, unknown>): boolean {
	return prop?.type === "array" && (prop.items as Record<string, unknown> | undefined)?.type === "object"
}

function shouldRecurseProp(prop: Record<string, unknown>): boolean {
	return prop?.type === "object" || isArrayOfObjects(prop)
}

/**
 * Recursively marks every property in a JSON Schema object as required
 * and sets `additionalProperties: false`.
 *
 * @param schema - A JSON Schema object (must have type: "object")
 * @returns A new schema with all properties required
 */
export function ensureAllRequired(schema: Record<string, unknown>): Record<string, unknown> {
	if (!isObjectSchema(schema)) {
		return schema
	}

	const result = { ...schema }

	if (result.additionalProperties !== false) {
		result.additionalProperties = false
	}

	if (!result.properties) {
		return result
	}

	const allKeys = Object.keys(result.properties)
	result.required = allKeys

	const newProps: Record<string, unknown> = { ...result.properties }
	for (const key of allKeys) {
		const prop = newProps[key] as Record<string, unknown> | undefined
		if (!prop || !shouldRecurseProp(prop)) {
			continue
		}
		newProps[key] = ensureAllRequired(prop)
	}
	result.properties = newProps

	return result
}

/**
 * Recursively sets `additionalProperties: false` on every object schema
 * without modifying the `required` array.
 *
 * @param schema - A JSON Schema object (must have type: "object")
 * @returns A new schema with additionalProperties: false on all nested objects
 */
export function ensureAdditionalPropertiesFalse(schema: Record<string, unknown>): Record<string, unknown> {
	if (!isObjectSchema(schema)) {
		return schema
	}

	const result = { ...schema }

	if (result.additionalProperties !== false) {
		result.additionalProperties = false
	}

	if (!result.properties) {
		return result
	}

	const newProps: Record<string, unknown> = { ...result.properties }
	for (const key of Object.keys(result.properties)) {
		const prop = newProps[key] as Record<string, unknown> | undefined
		if (!prop || !shouldRecurseProp(prop)) {
			continue
		}
		newProps[key] = ensureAdditionalPropertiesFalse(prop)
	}
	result.properties = newProps

	return result
}
