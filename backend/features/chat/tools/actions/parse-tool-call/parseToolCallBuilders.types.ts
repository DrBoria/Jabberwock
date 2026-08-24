export interface ToolBuildResult {
	nativeArgs: Record<string, unknown>
	usedLegacyFormat?: boolean
}

export interface ToolArgConfig {
	params: readonly string[]
	required?: readonly string[]
	specialParams?: Record<string, "boolean" | "number">
	builder?: (args: Record<string, unknown>) => ToolBuildResult | null
}

export interface RawApiFileEntry {
	path?: unknown
	line_ranges?: unknown
}
