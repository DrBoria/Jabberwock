export function coerceOptionalBoolean(value: unknown): boolean | undefined {
	if (typeof value === "boolean") {
		return value
	}
	if (typeof value === "string") {
		const lower = value.trim().toLowerCase()
		if (lower === "true") {
			return true
		}
		if (lower === "false") {
			return false
		}
	}
	return undefined
}

export function coerceOptionalNumber(value: unknown): number | undefined {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value
	}
	if (typeof value === "string") {
		const n = Number(value)
		if (Number.isFinite(n)) {
			return n
		}
	}
	return undefined
}
