import type { ToolBuildResult, ToolArgConfig, RawApiFileEntry } from "./parseToolCallBuilders.types"
import { resolveToolArgConfig, assignCoercedParam } from "./parseToolCallBuilders.config"

export function buildToolArgs(name: string, args: Record<string, unknown>, lax: boolean): ToolBuildResult | null {
	const config = resolveToolArgConfig(name)
	if (!config) {
		return null
	}

	if (config.builder) {
		return config.builder(args)
	}

	const required = config.required ?? config.params

	if (lax && !config.params.some((p) => args[p] !== undefined)) {
		return null
	}
	if (!lax && !required.every((p) => args[p] !== undefined)) {
		return null
	}

	const nativeArgs: Record<string, unknown> = {}
	for (const param of config.params) {
		assignCoercedParam(nativeArgs, param, args, config.specialParams)
	}

	return { nativeArgs }
}
