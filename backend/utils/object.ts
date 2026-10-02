/**
 * Check if an object is empty (has no own enumerable properties)
 * @param obj The object to check
 * @returns true if the object is empty, false otherwise
 */
export function isEmpty(obj: unknown): boolean {
	if (!obj || typeof obj !== "object") {
		return true
	}

	// Check if it's an array
	if (Array.isArray(obj)) {
		return obj.length === 0
	}

	// Check if it's an object with no own properties
	return Object.keys(obj).length === 0
}

/**
 * Type guard: value is a plain (non-null, non-array) object.
 * @param value The value to check
 * @returns true if value is a plain object
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value)
}
