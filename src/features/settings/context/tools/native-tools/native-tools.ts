import type OpenAI from "openai"
import analyzeImage from "./a-c/analyze_image"
import accessMcpResource from "./a-c/access_mcp_resource"
import { apply_diff } from "./a-c/apply_diff"
import applyPatch from "./a-c/apply_patch"
import askFollowupQuestion from "./a-c/ask_followup_question"
import delegateTask from "./d-g/delegate_task"
import attemptCompletion from "./a-c/attempt_completion"
import codebaseSearch from "./a-c/codebase_search"
import editTool from "./d-g/edit"
import executeCommand from "./d-g/execute_command"
import generateImage from "./d-g/generate_image"
import listFiles from "./l-n/list_files"
import newTask from "./l-n/new_task"
import readCommandOutput from "./r/read_command_output"
import { createReadFileTool, type ReadFileToolOptions } from "./r/read_file"
import runSlashCommand from "./r/run_slash_command"
import skill from "./s-w/skill"
import searchReplace from "./s-w/search_replace"
import edit_file from "./d-g/edit_file"
import searchFiles from "./s-w/search_files"
import switchMode from "./s-w/switch_mode"
import thinkTool from "./s-w/think_tool"
import writeToFile from "./s-w/write_to_file"

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
		writeToFile,
	] satisfies OpenAI.Chat.ChatCompletionTool[]
}

// Backward compatibility: export default tools with line ranges enabled
export const nativeTools = getNativeTools()
