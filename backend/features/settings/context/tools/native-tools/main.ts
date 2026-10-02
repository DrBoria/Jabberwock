import type OpenAI from "openai"
import contextSearch from "./context/context_search"
import contextRecall from "./context/context_recall"
import analyzeImage from "./media/analyze_image"
import accessMcpResource from "./mcp/access_mcp_resource"
import { apply_diff } from "./write/apply_diff"
import applyPatch from "./write/apply_patch"
import askFollowupQuestion from "./interaction/ask_followup_question"
import delegateTask from "./task/delegate_task"
import attemptCompletion from "./task/attempt_completion"
import codebaseSearch from "./read/codebase_search"
import { edit as editTool } from "./write/edit"
import executeCommand from "./execute/execute_command"
import generateImage from "./media/generate_image"
import listFiles from "./read/list_files"
import newTask from "./task/new_task"
import readCommandOutput from "./read/read_command_output"
import { createReadFileTool, type ReadFileToolOptions } from "./read/read_file"
import runSlashCommand from "./execute/run_slash_command"
import skill from "./interaction/skill"
import searchReplace from "./write/search_replace"
import { edit_file } from "./write/edit"
import searchFiles from "./read/search_files"
import switchMode from "./interaction/switch_mode"
import thinkTool from "./interaction/think_tool"
import writeToFile from "./write/write_to_file"

/**
 * Options for customizing the native tools array.
 */
export interface NativeToolsOptions {
	/** Whether the model supports image processing (default: false) */
	supportsImages?: boolean
}

/**
 * Get native tools array, optionally customizing based on settings.
 *
 * @param options - Configuration options for the tools
 * @returns Array of native tool definitions
 */
export function getNativeTools(options: NativeToolsOptions = {}): OpenAI.Chat.ChatCompletionTool[] {
	const { supportsImages = false } = options

	const readFileOptions: ReadFileToolOptions = {
		supportsImages,
	}

	return [
		analyzeImage as OpenAI.Chat.ChatCompletionTool,
		accessMcpResource,
		apply_diff,
		applyPatch,
		askFollowupQuestion,
		delegateTask,
		attemptCompletion,
		codebaseSearch,
		executeCommand,
		generateImage,
		listFiles,
		newTask,
		readCommandOutput,
		createReadFileTool(readFileOptions),
		runSlashCommand,
		skill,
		searchReplace,
		edit_file,
		editTool,
		searchFiles,
		switchMode,
		thinkTool,
		contextSearch,
		contextRecall,
		writeToFile,
	] satisfies OpenAI.Chat.ChatCompletionTool[]
}

// Backward compatibility: export default tools with line ranges enabled
export const nativeTools = getNativeTools()
