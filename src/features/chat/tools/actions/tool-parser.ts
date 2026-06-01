import { parseJSON } from "partial-json"

import { type ToolName, toolNames, type FileEntry } from "@jabberwock/types"
import { customToolRegistry } from "@jabberwock/core"

import {
	type ToolUse,
	type McpToolUse,
	type ToolParamName,
	type NativeToolArgs,
	toolParamNames,
} from "../../../../shared/tools"
import { resolveToolAlias } from "../../../settings/context/tools/filter-tools-for-mode"
import { MCP_TOOL_PREFIX, MCP_TOOL_SEPARATOR, parseMcpToolName, normalizeMcpToolName } from "../../../../utils/mcp-name"

/**
 * Helper type to extract properly typed native arguments for a given tool.
 */
type NativeArgsFor<TName extends ToolName> = TName extends keyof NativeToolArgs ? NativeToolArgs[TName] : never

/**
 * Minimal shape of a raw API file entry as returned by the model during streaming.
 */
interface RawApiFileEntry {
	path?: unknown
	line_ranges?: unknown
}

// ─── Utility coercion helpers ───────────────────────────────────────────

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

// ─── File entry conversion ──────────────────────────────────────────────

/**
 * Convert raw file entries from API (with line_ranges) to FileEntry objects.
 */
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

// ─── Create partial ToolUse for streaming ───────────────────────────────

/**
 * Create a partial ToolUse from currently parsed arguments.
 * Used during streaming to show progress.
 */
function createPartialToolUse(
	id: string,
	name: ToolName,
	partialArgs: { [key: string]: unknown },
	partial: boolean,
	originalName?: string,
): ToolUse | null {
	const params: Partial<Record<ToolParamName, string>> = {}

	for (const [key, value] of Object.entries(partialArgs)) {
		if (toolParamNames.includes(key as ToolParamName)) {
			params[key as ToolParamName] = typeof value === "string" ? value : JSON.stringify(value)
		}
	}

	let nativeArgs: { [key: string]: unknown } | undefined
	let usedLegacyFormat = false

	switch (name) {
		case "read_file":
			if (partialArgs.files !== undefined) {
				let filesArray: unknown[] | null = null

				if (Array.isArray(partialArgs.files)) {
					filesArray = partialArgs.files
				} else if (typeof partialArgs.files === "string") {
					try {
						const parsed = JSON.parse(partialArgs.files)
						if (Array.isArray(parsed)) {
							filesArray = parsed
						}
					} catch {
						// Not valid JSON, ignore
					}
				}

				if (filesArray && filesArray.length > 0) {
					usedLegacyFormat = true
					nativeArgs = {
						files: convertFileEntries(filesArray),
						_legacyFormat: true as const,
					}
				}
			}
			if (!nativeArgs && partialArgs.path !== undefined) {
				nativeArgs = {
					path: partialArgs.path,
					mode: partialArgs.mode,
					offset: coerceOptionalNumber(partialArgs.offset),
					limit: coerceOptionalNumber(partialArgs.limit),
					indentation:
						partialArgs.indentation && typeof partialArgs.indentation === "object"
							? {
									anchor_line: coerceOptionalNumber(
										(partialArgs.indentation as { [key: string]: unknown }).anchor_line,
									),
									max_levels: coerceOptionalNumber(
										(partialArgs.indentation as { [key: string]: unknown }).max_levels,
									),
									max_lines: coerceOptionalNumber(
										(partialArgs.indentation as { [key: string]: unknown }).max_lines,
									),
									include_siblings: coerceOptionalBoolean(
										(partialArgs.indentation as { [key: string]: unknown }).include_siblings,
									),
									include_header: coerceOptionalBoolean(
										(partialArgs.indentation as { [key: string]: unknown }).include_header,
									),
								}
							: undefined,
				}
			}
			break

		case "attempt_completion":
			if (partialArgs.result) {
				nativeArgs = { result: partialArgs.result }
			}
			break

		case "execute_command":
			if (partialArgs.command) {
				nativeArgs = {
					command: partialArgs.command,
					cwd: partialArgs.cwd,
					timeout: partialArgs.timeout,
				}
			}
			break

		case "write_to_file":
			if (partialArgs.path || partialArgs.content) {
				nativeArgs = {
					path: partialArgs.path,
					content: partialArgs.content,
				}
			}
			break

		case "ask_followup_question":
			if (partialArgs.question !== undefined || partialArgs.follow_up !== undefined) {
				nativeArgs = {
					question: partialArgs.question,
					follow_up: Array.isArray(partialArgs.follow_up) ? partialArgs.follow_up : undefined,
				}
			}
			break

		case "apply_diff":
			if (partialArgs.path !== undefined || partialArgs.diff !== undefined) {
				nativeArgs = {
					path: partialArgs.path,
					diff: partialArgs.diff,
				}
			}
			break

		case "codebase_search":
			if (partialArgs.query !== undefined) {
				nativeArgs = {
					query: partialArgs.query,
					path: partialArgs.path,
				}
			}
			break

		case "analyze_image":
			if (partialArgs.prompt !== undefined || partialArgs.path !== undefined) {
				nativeArgs = {
					prompt: partialArgs.prompt,
					path: partialArgs.path,
				}
			}
			break

		case "generate_image":
			if (partialArgs.prompt !== undefined || partialArgs.path !== undefined) {
				nativeArgs = {
					prompt: partialArgs.prompt,
					path: partialArgs.path,
					image: partialArgs.image,
				}
			}
			break

		case "run_slash_command":
			if (partialArgs.command !== undefined) {
				nativeArgs = {
					command: partialArgs.command,
					args: partialArgs.args,
				}
			}
			break

		case "skill":
			if (partialArgs.skill !== undefined) {
				nativeArgs = {
					skill: partialArgs.skill,
					args: partialArgs.args,
				}
			}
			break

		case "search_files":
			if (partialArgs.path !== undefined || partialArgs.regex !== undefined) {
				nativeArgs = {
					path: partialArgs.path,
					regex: partialArgs.regex,
					file_pattern: partialArgs.file_pattern,
				}
			}
			break

		case "switch_mode":
			if (partialArgs.mode_slug !== undefined || partialArgs.reason !== undefined) {
				nativeArgs = {
					mode_slug: partialArgs.mode_slug,
					reason: partialArgs.reason,
				}
			}
			break

		case "update_todo_list":
			if (partialArgs.todos !== undefined) {
				nativeArgs = {
					todos: partialArgs.todos,
				}
			}
			break

		case "use_mcp_tool":
			if (partialArgs.server_name !== undefined || partialArgs.tool_name !== undefined) {
				nativeArgs = {
					server_name: partialArgs.server_name,
					tool_name: partialArgs.tool_name,
					arguments: partialArgs.arguments,
				}
			}
			break

		case "apply_patch":
			if (partialArgs.patch !== undefined) {
				nativeArgs = {
					patch: partialArgs.patch,
				}
			}
			break

		case "search_replace":
			if (
				partialArgs.file_path !== undefined ||
				partialArgs.old_string !== undefined ||
				partialArgs.new_string !== undefined
			) {
				nativeArgs = {
					file_path: partialArgs.file_path,
					old_string: partialArgs.old_string,
					new_string: partialArgs.new_string,
				}
			}
			break

		case "edit":
		case "search_and_replace":
			if (
				partialArgs.file_path !== undefined ||
				partialArgs.old_string !== undefined ||
				partialArgs.new_string !== undefined
			) {
				nativeArgs = {
					file_path: partialArgs.file_path,
					old_string: partialArgs.old_string,
					new_string: partialArgs.new_string,
					replace_all: coerceOptionalBoolean(partialArgs.replace_all),
				}
			}
			break

		case "edit_file":
			if (
				partialArgs.file_path !== undefined ||
				partialArgs.old_string !== undefined ||
				partialArgs.new_string !== undefined
			) {
				nativeArgs = {
					file_path: partialArgs.file_path,
					old_string: partialArgs.old_string,
					new_string: partialArgs.new_string,
					expected_replacements: partialArgs.expected_replacements,
				}
			}
			break

		case "list_files":
			if (partialArgs.path !== undefined) {
				nativeArgs = {
					path: partialArgs.path,
					recursive: coerceOptionalBoolean(partialArgs.recursive),
				}
			}
			break

		case "new_task":
			if (partialArgs.mode !== undefined || partialArgs.message !== undefined) {
				nativeArgs = {
					mode: partialArgs.mode,
					message: partialArgs.message,
					todos: partialArgs.todos,
				}
			}
			break

		case "delegate_task":
			if (
				partialArgs.task_id !== undefined ||
				partialArgs.target_role !== undefined ||
				partialArgs.message !== undefined
			) {
				nativeArgs = {
					task_id: partialArgs.task_id,
					target_role: partialArgs.target_role,
					message: partialArgs.message,
					is_async: coerceOptionalBoolean(partialArgs.is_async),
				}
			}
			break

		default:
			break
	}

	const result: ToolUse = {
		type: "tool_use" as const,
		name,
		params,
		partial,
		nativeArgs: nativeArgs as ToolUse["nativeArgs"],
	}

	if (originalName) {
		result.originalName = originalName
	}

	if (usedLegacyFormat) {
		result.usedLegacyFormat = true
	}

	return result
}

// ─── Parse streaming partial tool call ──────────────────────────────────

/**
 * Parse a partial JSON accumulator and return a partial ToolUse.
 * Returns null if the partial JSON is too malformed to parse.
 * For dynamic MCP tools, returns null (wait for final).
 */
export function parsePartialToolCall(id: string, name: string, argumentsAccumulator: string): ToolUse | null {
	const mcpPrefix = MCP_TOOL_PREFIX + MCP_TOOL_SEPARATOR
	if (name.startsWith(mcpPrefix)) {
		return null
	}

	try {
		const partialArgs = parseJSON(argumentsAccumulator)
		const resolvedName = resolveToolAlias(name) as ToolName
		const originalName = name !== resolvedName ? name : undefined

		return createPartialToolUse(id, resolvedName, partialArgs || {}, true, originalName)
	} catch {
		return null
	}
}

/**
 * Finalize a streaming tool call — parse the complete accumulated JSON
 * and return the final ToolUse or McpToolUse.
 */
export function parseFinalToolCall(
	id: string,
	name: string,
	argumentsAccumulator: string,
): ToolUse | McpToolUse | null {
	return parseToolCall({
		id,
		name: name as ToolName,
		arguments: argumentsAccumulator,
	})
}

// ─── Parse complete tool call ───────────────────────────────────────────

/**
 * Convert a native tool call chunk to a ToolUse object.
 */
export function parseToolCall<TName extends ToolName>(toolCall: {
	id: string
	name: TName
	arguments: string
}): ToolUse<TName> | McpToolUse | null {
	const mcpPrefix = MCP_TOOL_PREFIX + MCP_TOOL_SEPARATOR

	if (typeof toolCall.name === "string") {
		const normalizedName = normalizeMcpToolName(toolCall.name)
		if (normalizedName.startsWith(mcpPrefix)) {
			return parseDynamicMcpTool({ ...toolCall, name: normalizedName })
		}
	}

	const resolvedName = resolveToolAlias(toolCall.name as string) as TName

	if (!toolNames.includes(resolvedName as ToolName) && !customToolRegistry.has(resolvedName)) {
		console.error(`[jabberwock] Invalid tool name: ${toolCall.name} (resolved: ${resolvedName})`)
		console.error(`[jabberwock] Valid tool names:`, toolNames)
		return null
	}

	try {
		const args = toolCall.arguments === "" ? {} : JSON.parse(toolCall.arguments)

		const params: Partial<Record<ToolParamName, string>> = {}

		for (const [key, value] of Object.entries(args)) {
			if (!toolParamNames.includes(key as ToolParamName) && !customToolRegistry.has(resolvedName)) {
				console.warn(`[jabberwock] Unknown parameter '${key}' for tool '${resolvedName}'`)
				console.warn(`[jabberwock] Valid param names:`, toolParamNames)
				continue
			}

			const stringValue = typeof value === "string" ? value : JSON.stringify(value)
			params[key as ToolParamName] = stringValue
		}

		let nativeArgs: NativeArgsFor<TName> | undefined = undefined
		let usedLegacyFormat = false

		switch (resolvedName) {
			case "read_file":
				if (args.files !== undefined) {
					let filesArray: unknown[] | null = null

					if (Array.isArray(args.files)) {
						filesArray = args.files
					} else if (typeof args.files === "string") {
						try {
							const parsed = JSON.parse(args.files)
							if (Array.isArray(parsed)) {
								filesArray = parsed
							}
						} catch {
							// Not valid JSON, ignore
						}
					}

					if (filesArray && filesArray.length > 0) {
						usedLegacyFormat = true
						nativeArgs = {
							files: convertFileEntries(filesArray),
							_legacyFormat: true as const,
						} as NativeArgsFor<TName>
					}
				}
				if (!nativeArgs && args.path !== undefined) {
					nativeArgs = {
						path: args.path,
						mode: args.mode,
						offset: coerceOptionalNumber(args.offset),
						limit: coerceOptionalNumber(args.limit),
						indentation:
							args.indentation && typeof args.indentation === "object"
								? {
										anchor_line: coerceOptionalNumber(args.indentation.anchor_line),
										max_levels: coerceOptionalNumber(args.indentation.max_levels),
										max_lines: coerceOptionalNumber(args.indentation.max_lines),
										include_siblings: coerceOptionalBoolean(args.indentation.include_siblings),
										include_header: coerceOptionalBoolean(args.indentation.include_header),
									}
								: undefined,
					} as NativeArgsFor<TName>
				}
				break

			case "attempt_completion":
				if (args.result) {
					nativeArgs = { result: args.result } as NativeArgsFor<TName>
				}
				break

			case "execute_command":
				if (args.command) {
					nativeArgs = {
						command: args.command,
						cwd: args.cwd,
						timeout: args.timeout,
					} as NativeArgsFor<TName>
				}
				break

			case "apply_diff":
				if (args.path !== undefined && args.diff !== undefined) {
					nativeArgs = {
						path: args.path,
						diff: args.diff,
					} as NativeArgsFor<TName>
				}
				break

			case "edit":
			case "search_and_replace":
				if (args.file_path !== undefined && args.old_string !== undefined && args.new_string !== undefined) {
					nativeArgs = {
						file_path: args.file_path,
						old_string: args.old_string,
						new_string: args.new_string,
						replace_all: coerceOptionalBoolean(args.replace_all),
					} as NativeArgsFor<TName>
				}
				break

			case "ask_followup_question":
				if (args.question !== undefined && args.follow_up !== undefined) {
					nativeArgs = {
						question: args.question,
						follow_up: args.follow_up,
					} as NativeArgsFor<TName>
				}
				break

			case "codebase_search":
				if (args.query !== undefined) {
					nativeArgs = {
						query: args.query,
						path: args.path,
					} as NativeArgsFor<TName>
				}
				break

			case "analyze_image":
				if (args.path !== undefined) {
					nativeArgs = {
						prompt: args.prompt,
						path: args.path,
					} as NativeArgsFor<TName>
				}
				break

			case "generate_image":
				if (args.prompt !== undefined && args.path !== undefined) {
					nativeArgs = {
						prompt: args.prompt,
						path: args.path,
						image: args.image,
					} as NativeArgsFor<TName>
				}
				break

			case "run_slash_command":
				if (args.command !== undefined) {
					nativeArgs = {
						command: args.command,
						args: args.args,
					} as NativeArgsFor<TName>
				}
				break

			case "skill":
				if (args.skill !== undefined) {
					nativeArgs = {
						skill: args.skill,
						args: args.args,
					} as NativeArgsFor<TName>
				}
				break

			case "search_files":
				if (args.path !== undefined && args.regex !== undefined) {
					nativeArgs = {
						path: args.path,
						regex: args.regex,
						file_pattern: args.file_pattern,
					} as NativeArgsFor<TName>
				}
				break

			case "switch_mode":
				if (args.mode_slug !== undefined && args.reason !== undefined) {
					nativeArgs = {
						mode_slug: args.mode_slug,
						reason: args.reason,
					} as NativeArgsFor<TName>
				}
				break

			case "update_todo_list":
				if (args.todos !== undefined) {
					nativeArgs = {
						todos: args.todos,
					} as NativeArgsFor<TName>
				}
				break

			case "read_command_output":
				if (args.artifact_id !== undefined) {
					nativeArgs = {
						artifact_id: args.artifact_id,
						search: args.search,
						offset: args.offset,
						limit: args.limit,
					} as NativeArgsFor<TName>
				}
				break

			case "write_to_file":
				if (args.path !== undefined && args.content !== undefined) {
					nativeArgs = {
						path: args.path,
						content: args.content,
					} as NativeArgsFor<TName>
				}
				break

			case "use_mcp_tool":
				if (args.server_name !== undefined && args.tool_name !== undefined) {
					nativeArgs = {
						server_name: args.server_name,
						tool_name: args.tool_name,
						arguments: args.arguments,
					} as NativeArgsFor<TName>
				}
				break

			case "access_mcp_resource":
				if (args.server_name !== undefined && args.uri !== undefined) {
					nativeArgs = {
						server_name: args.server_name,
						uri: args.uri,
					} as NativeArgsFor<TName>
				}
				break

			case "apply_patch":
				if (args.patch !== undefined) {
					nativeArgs = {
						patch: args.patch,
					} as NativeArgsFor<TName>
				}
				break

			case "search_replace":
				if (args.file_path !== undefined && args.old_string !== undefined && args.new_string !== undefined) {
					nativeArgs = {
						file_path: args.file_path,
						old_string: args.old_string,
						new_string: args.new_string,
					} as NativeArgsFor<TName>
				}
				break

			case "edit_file":
				if (args.file_path !== undefined && args.old_string !== undefined && args.new_string !== undefined) {
					nativeArgs = {
						file_path: args.file_path,
						old_string: args.old_string,
						new_string: args.new_string,
						expected_replacements: args.expected_replacements,
					} as NativeArgsFor<TName>
				}
				break

			case "list_files":
				if (args.path !== undefined) {
					nativeArgs = {
						path: args.path,
						recursive: coerceOptionalBoolean(args.recursive),
					} as NativeArgsFor<TName>
				}
				break

			case "new_task":
				if (args.mode !== undefined && args.message !== undefined) {
					nativeArgs = {
						mode: args.mode,
						message: args.message,
						todos: args.todos,
					} as NativeArgsFor<TName>
				}
				break

			case "delegate_task":
				if (args.task_id !== undefined && args.target_role !== undefined && args.message !== undefined) {
					nativeArgs = {
						task_id: args.task_id,
						target_role: args.target_role,
						message: args.message,
						is_async: args.is_async,
					} as NativeArgsFor<TName>
				}
				break

			default:
				if (customToolRegistry.has(resolvedName)) {
					nativeArgs = args as NativeArgsFor<TName>
				}
				break
		}

		if (!nativeArgs && !customToolRegistry.has(resolvedName)) {
			throw new Error(
				`[tool-parser] Invalid arguments for tool '${resolvedName}'. ` +
					`Native tool calls require a valid JSON payload matching the tool schema. ` +
					`Received: ${JSON.stringify(args)}`,
			)
		}

		const result: ToolUse<TName> = {
			type: "tool_use" as const,
			name: resolvedName,
			params,
			partial: false,
			nativeArgs,
		}

		if (toolCall.name !== resolvedName) {
			result.originalName = toolCall.name
		}

		if (usedLegacyFormat) {
			result.usedLegacyFormat = true
		}

		return result
	} catch (error) {
		console.error(`Failed to parse tool call arguments: ${error instanceof Error ? error.message : String(error)}`)
		console.error(`[jabberwock] Tool call: ${JSON.stringify(toolCall, null, 2)}`)
		return null
	}
}

/**
 * Parse dynamic MCP tools (named mcp--serverName--toolName).
 */
export function parseDynamicMcpTool(toolCall: { id: string; name: string; arguments: string }): McpToolUse | null {
	try {
		const args = JSON.parse(toolCall.arguments || "{}")
		const normalizedName = normalizeMcpToolName(toolCall.name)
		const parsed = parseMcpToolName(normalizedName)
		if (!parsed) {
			console.error(
				`[jabberwock] Invalid dynamic MCP tool name format: ${toolCall.name} (normalized: ${normalizedName})`,
			)
			return null
		}

		const { serverName, toolName } = parsed

		const result: McpToolUse = {
			type: "mcp_tool_use" as const,
			id: toolCall.id,
			name: toolCall.name,
			serverName,
			toolName,
			arguments: args,
			partial: false,
		}

		return result
	} catch (error) {
		console.error(`[jabberwock] Failed to parse dynamic MCP tool:`, error)
		return null
	}
}
