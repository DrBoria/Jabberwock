import { Anthropic } from "@anthropic-ai/sdk"
import * as path from "path"
import * as diff from "diff"
import { validateAccess } from "@utils/ignore"
import { LOCK_TEXT_SYMBOL } from "@features/settings/constants"
import { isWriteProtected } from "@utils/protect"

export const formatResponse = {
	toolDenied: () =>
		JSON.stringify({
			status: "denied",
			message: "The user denied this operation.",
		}),

	toolDeniedWithFeedback: (feedback?: string) =>
		JSON.stringify({
			status: "denied",
			feedback,
		}),

	toolApprovedWithFeedback: (feedback?: string) =>
		JSON.stringify({
			status: "approved",
			feedback,
		}),

	toolError: (error?: string) =>
		JSON.stringify({
			status: "error",
			message: "The tool execution failed",
			error,
		}),

	jabberwockIgnoreError: (path: string) =>
		JSON.stringify({
			status: "error",
			type: "access_denied",
			message: "Access blocked by .jabberwockignore",
			path,
			suggestion: "Try to continue without this file, or ask the user to update the .jabberwockignore file",
		}),

	noToolsUsed: () => {
		const instructions = getToolInstructionsReminder()

		return `[ERROR] You did not use a tool in your previous response! Please retry with a tool use.

${instructions}

# Next Steps

If you have completed the user's task, use the attempt_completion tool.
If you require additional information from the user, use the ask_followup_question tool.
Otherwise, if you have not completed the task and do not need additional information, then proceed with the next step of the task.
(This is an automated message, so do not respond to it conversationally.)`
	},

	tooManyMistakes: (feedback?: string) =>
		JSON.stringify({
			status: "guidance",
			feedback,
		}),

	missingToolParameterError: (paramName: string) => {
		const instructions = getToolInstructionsReminder()

		return `Missing value for required parameter '${paramName}'. Please retry with complete response.\n\n${instructions}`
	},

	invalidMcpToolArgumentError: (serverName: string, toolName: string) =>
		JSON.stringify({
			status: "error",
			type: "invalid_argument",
			message: "Invalid JSON argument",
			server: serverName,
			tool: toolName,
			suggestion: "Please retry with a properly formatted JSON argument",
		}),

	unknownMcpToolError: (serverName: string, toolName: string, availableTools: string[]) =>
		JSON.stringify({
			status: "error",
			type: "unknown_tool",
			message: "Tool does not exist on server",
			server: serverName,
			tool: toolName,
			available_tools: availableTools.length > 0 ? availableTools : [],
			suggestion: "Please use one of the available tools or check if the server is properly configured",
		}),

	unknownMcpServerError: (serverName: string, availableServers: string[]) =>
		JSON.stringify({
			status: "error",
			type: "unknown_server",
			message: "Server is not configured",
			server: serverName,
			available_servers: availableServers.length > 0 ? availableServers : [],
		}),

	toolResult: (
		text: string,
		images?: string[],
	): string | Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> => {
		if (images && images.length > 0) {
			const textBlock: Anthropic.TextBlockParam = { type: "text", text }
			const imageBlocks: Anthropic.ImageBlockParam[] = formatImagesIntoBlocks(images)
			// Placing images after text leads to better results
			return [textBlock, ...imageBlocks]
		} else {
			return text
		}
	},

	imageBlocks: (images?: string[]): Anthropic.ImageBlockParam[] => {
		return formatImagesIntoBlocks(images)
	},

	formatFilesList: (
		absolutePath: string,
		files: string[],
		didHitLimit: boolean,
		ignorePatterns: string | undefined,
		showJabberwockIgnoredFiles: boolean,
		cwd?: string,
	): string => {
		const sorted = files
			.map((file) => {
				const relativePath = path.relative(absolutePath, file).toPosix()
				return file.endsWith("/") ? relativePath + "/" : relativePath
			})
			.sort(comparePaths)

		const rooIgnoreParsed = ignorePatterns
			? processIgnorePatterns(sorted, absolutePath, ignorePatterns, showJabberwockIgnoredFiles, cwd)
			: sorted

		return formatFileListResult(rooIgnoreParsed, didHitLimit)
	},

	createPrettyPatch: (filename = "file", oldStr?: string, newStr?: string) => {
		// strings cannot be undefined or diff throws exception
		const patch = diff.createPatch(filename.toPosix(), oldStr || "", newStr || "", undefined, undefined, {
			context: 3,
		})
		const lines = patch.split("\n")
		const prettyPatchLines = lines.slice(4)
		return prettyPatchLines.join("\n")
	},
}

// to avoid circular dependency
const formatImagesIntoBlocks = (images?: string[]): Anthropic.ImageBlockParam[] => {
	return images
		? images.map((dataUrl) => {
				// data:image/png;base64,base64string
				const [rest, base64] = dataUrl.split(",")
				const mimeType = rest.split(":")[1].split(";")[0]
				return {
					type: "image",
					source: { type: "base64", media_type: mimeType, data: base64 },
				} as Anthropic.ImageBlockParam
			})
		: []
}

const toolUseInstructionsReminderNative = `# Reminder: Instructions for Tool Use

Tools are invoked using the platform's native tool calling mechanism. Each tool requires specific parameters as defined in the tool descriptions. Refer to the tool definitions provided in your system instructions for the correct parameter structure and usage examples.

Always ensure you provide all required parameters for the tool you wish to use.`

/**
 * Gets the tool use instructions reminder.
 */
function getToolInstructionsReminder(): string {
	return toolUseInstructionsReminderNative
}

function comparePaths(a: string, b: string): number {
	const aParts = a.split("/")
	const bParts = b.split("/")
	for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
		if (aParts[i] === bParts[i]) {
			continue
		}

		if (i + 1 === aParts.length && i + 1 < bParts.length) {
			return -1
		}

		if (i + 1 === bParts.length && i + 1 < aParts.length) {
			return 1
		}

		return aParts[i].localeCompare(bParts[i], undefined, { numeric: true, sensitivity: "base" })
	}

	return aParts.length - bParts.length
}

function processIgnorePatterns(
	sorted: string[],
	absolutePath: string,
	ignorePatterns: string,
	showJabberwockIgnoredFiles: boolean,
	cwd?: string,
): string[] {
	const result: string[] = []
	for (const filePath of sorted) {
		const absoluteFilePath = path.resolve(absolutePath, filePath)
		const isIgnored = !validateAccess(ignorePatterns, absoluteFilePath, cwd ?? absolutePath)

		if (isIgnored) {
			if (!showJabberwockIgnoredFiles) {
				continue
			}
			result.push(LOCK_TEXT_SYMBOL + " " + filePath)
		} else {
			const isWriteProtectedFile = cwd ? isWriteProtected(cwd, absoluteFilePath) : false
			if (isWriteProtectedFile) {
				result.push("🛡️ " + filePath)
			} else {
				result.push(filePath)
			}
		}
	}
	return result
}

function formatFileListResult(rooIgnoreParsed: string[], didHitLimit: boolean): string {
	if (didHitLimit) {
		return `${rooIgnoreParsed.join("\n")}\n\n(File list truncated. Use list_files on specific subdirectories if you need to explore further.)`
	}

	if (rooIgnoreParsed.length === 0 || (rooIgnoreParsed.length === 1 && rooIgnoreParsed[0] === "")) {
		return "No files found."
	}

	return rooIgnoreParsed.join("\n")
}
