import { type FileEntry } from "@jabberwock/types"

import type { ToolArgConfig, ToolBuildResult, RawApiFileEntry } from "./parseToolCallBuilders.types"
import { coerceOptionalBoolean, coerceOptionalNumber } from "./parseToolCallBuilders.coercion"

function convertFileEntries(files: unknown[]): FileEntry[] {
	return files.map((file: unknown) => {
		const f = file as RawApiFileEntry
		const entry: FileEntry = { path: f.path as string }
		const lineRanges = f.line_ranges
		if (Array.isArray(lineRanges)) {
			entry.lineRanges = lineRanges
				.map((range) => {
					if (Array.isArray(range) && range.length >= 2) {
						return { start: Number(range[0]), end: Number(range[1]) }
					}
					if (typeof range === "object" && range !== null && "start" in range && "end" in range) {
						const r = range as { start: unknown; end: unknown }
						return { start: Number(r.start), end: Number(r.end) }
					}
					if (typeof range === "string") {
						const match = range.match(/^(\d+)-(\d+)$/)
						if (match) {
							return { start: parseInt(match[1], 10), end: parseInt(match[2], 10) }
						}
					}
					return null
				})
				.filter((r): r is { start: number; end: number } => r !== null)
		}
		return entry
	})
}

function parseFilesArrayInput(filesInput: unknown): unknown[] | null {
	if (Array.isArray(filesInput)) {
		return filesInput
	}
	if (typeof filesInput === "string") {
		try {
			const parsed = JSON.parse(filesInput)
			if (Array.isArray(parsed)) {
				return parsed
			}
		} catch {
			// Not valid JSON, ignore
		}
	}
	return null
}

function buildReadFileArgs(args: Record<string, unknown>): ToolBuildResult | null {
	if (args.files !== undefined) {
		const filesArray = parseFilesArrayInput(args.files)
		if (filesArray && filesArray.length > 0) {
			return {
				nativeArgs: {
					files: convertFileEntries(filesArray),
					_legacyFormat: true as const,
				},
				usedLegacyFormat: true,
			}
		}
	}

	if (args.path !== undefined) {
		const nativeArgs: Record<string, unknown> = {
			path: args.path,
			mode: args.mode,
			offset: coerceOptionalNumber(args.offset),
			limit: coerceOptionalNumber(args.limit),
		}

		if (args.indentation && typeof args.indentation === "object") {
			const ind = args.indentation as Record<string, unknown>
			nativeArgs.indentation = {
				anchor_line: coerceOptionalNumber(ind.anchor_line),
				max_levels: coerceOptionalNumber(ind.max_levels),
				max_lines: coerceOptionalNumber(ind.max_lines),
				include_siblings: coerceOptionalBoolean(ind.include_siblings),
				include_header: coerceOptionalBoolean(ind.include_header),
			}
		}

		return { nativeArgs }
	}

	return null
}

export const TOOL_ARG_CONFIGS: Record<string, ToolArgConfig | string> = {
	read_file: { params: [], builder: buildReadFileArgs },
	attempt_completion: { params: ["result"] },
	execute_command: { params: ["command", "cwd", "timeout"] },
	write_to_file: { params: ["path", "content"], required: ["path", "content"] },
	ask_followup_question: { params: ["question", "follow_up"], required: ["question", "follow_up"] },
	apply_diff: { params: ["path", "diff"], required: ["path", "diff"] },
	codebase_search: { params: ["query", "path"], required: ["query"] },
	analyze_image: { params: ["prompt", "path"], required: ["path"] },
	generate_image: { params: ["prompt", "path", "image"], required: ["prompt", "path"] },
	run_slash_command: { params: ["command", "args"], required: ["command"] },
	skill: { params: ["skill", "args"], required: ["skill"] },
	search_files: { params: ["path", "regex", "file_pattern"], required: ["path", "regex"] },
	switch_mode: { params: ["mode_slug", "reason"], required: ["mode_slug", "reason"] },
	update_todo_list: { params: ["todos"], required: ["todos"] },
	read_command_output: { params: ["artifact_id", "search", "offset", "limit"], required: ["artifact_id"] },
	use_mcp_tool: { params: ["server_name", "tool_name", "arguments"], required: ["server_name", "tool_name"] },
	access_mcp_resource: { params: ["server_name", "uri"], required: ["server_name", "uri"] },
	apply_patch: { params: ["patch"], required: ["patch"] },
	search_replace: {
		params: ["file_path", "old_string", "new_string"],
		required: ["file_path", "old_string", "new_string"],
	},
	edit: {
		params: ["file_path", "old_string", "new_string", "replace_all"],
		required: ["file_path", "old_string", "new_string"],
		specialParams: { replace_all: "boolean" },
	},
	edit_file: {
		params: ["file_path", "old_string", "new_string", "expected_replacements"],
		required: ["file_path", "old_string", "new_string"],
	},
	list_files: { params: ["path", "recursive"], required: ["path"], specialParams: { recursive: "boolean" } },
	new_task: { params: ["mode", "message", "todos"], required: ["mode", "message"] },
	delegate_task: {
		params: ["task_id", "target_role", "message", "is_async"],
		required: ["task_id", "target_role", "message"],
		specialParams: { is_async: "boolean" },
	},
	search_and_replace: "edit",
}

export function resolveToolArgConfig(name: string): ToolArgConfig | undefined {
	const rawConfig = TOOL_ARG_CONFIGS[name]
	if (!rawConfig) {
		return undefined
	}
	return typeof rawConfig === "string" ? (TOOL_ARG_CONFIGS[rawConfig] as ToolArgConfig) : rawConfig
}

export function assignCoercedParam(
	nativeArgs: Record<string, unknown>,
	param: string,
	args: Record<string, unknown>,
	specialParams?: Record<string, "boolean" | "number">,
): void {
	const value = args[param]
	if (value === undefined) {
		return
	}
	const special = specialParams?.[param]
	if (special === "boolean") {
		nativeArgs[param] = coerceOptionalBoolean(value)
	} else if (special === "number") {
		nativeArgs[param] = coerceOptionalNumber(value)
	} else {
		nativeArgs[param] = value
	}
}

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
