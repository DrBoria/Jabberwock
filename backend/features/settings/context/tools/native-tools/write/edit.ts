import type OpenAI from "openai"

const EDIT_DESCRIPTION = `Performs exact string replacements in files.

Usage:
- You must use your \`Read\` tool at least once in the conversation before editing. This tool will error if you attempt an edit without reading the file.
- When editing text from "Read" tool output, ensure you preserve the exact indentation (tabs/spaces) as it appears AFTER the line number prefix. The line number prefix format is: spaces + line number + tab. Everything after that tab is the actual file content to match. Never include any part of the line number prefix in the old_string or new_string.
- ALWAYS prefer editing existing files in the codebase. NEVER write new files unless explicitly required.
- Only use emojis if the user explicitly requests it. Avoid adding emojis to files unless asked.
- The edit will FAIL if \`old_string\` is not unique in the file. Either provide a larger string with more surrounding context to make it unique or use \`replace_all\` to change every instance of \`old_string\`.
- Use \`replace_all\` for replacing and renaming strings across the file. This parameter is useful if you want to rename a variable for instance.`

const edit = {
	type: "function",
	function: {
		name: "edit",
		description: EDIT_DESCRIPTION,
		parameters: {
			type: "object",
			properties: {
				file_path: {
					type: "string",
					description: "The path of the file to edit (relative to the working directory)",
				},
				old_string: {
					type: "string",
					description:
						"The exact text to find in the file. Must match exactly, including all whitespace, indentation, and line endings.",
				},
				new_string: {
					type: "string",
					description:
						"The replacement text that will replace old_string. Must include all necessary whitespace and indentation.",
				},
				replace_all: {
					type: "boolean",
					description:
						"When true, replaces ALL occurrences of old_string in the file. When false (default), only replaces the first occurrence and errors if multiple matches exist.",
					default: false,
				},
			},
			required: ["file_path", "old_string", "new_string"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool

export { edit }

const EDIT_FILE_DESCRIPTION = `Use this tool to replace text in an existing file, or create a new file.

This tool performs literal string replacement with support for multiple occurrences.

To be resilient to minor formatting drift, the tool normalizes line endings (CRLF/LF) for matching and may fall back to deterministic matching strategies when an exact literal match fails (exact → whitespace-tolerant match → token-based match). The original file's line endings are preserved when writing.

USAGE PATTERNS:

1. MODIFY EXISTING FILE (default):
   - Provide file_path, old_string (text to find), and new_string (replacement)
   - By default, expects exactly 1 occurrence of old_string
   - Use expected_replacements to replace multiple occurrences

2. CREATE NEW FILE:
   - Set old_string to empty string ""
   - new_string becomes the entire file content
   - File must not already exist

CRITICAL REQUIREMENTS:

1. EXACT MATCHING (BEST): The old_string should match the file contents EXACTLY, including:
    - All whitespace (spaces, tabs, newlines)
    - All indentation
    - All punctuation and special characters

2. CONTEXT FOR UNIQUENESS: For single replacements (default), include at least 3 lines of context BEFORE and AFTER the target text to ensure uniqueness.

3. MULTIPLE REPLACEMENTS: If you need to replace multiple identical occurrences:
   - Set expected_replacements to the exact count you expect to replace
   - ALL occurrences will be replaced

4. NO ESCAPING: Provide the literal text - do not escape special characters.`

const edit_file = {
	type: "function",
	function: {
		name: "edit_file",
		description: EDIT_FILE_DESCRIPTION,
		parameters: {
			type: "object",
			properties: {
				file_path: {
					type: "string",
					description:
						"The path to the file to modify or create. You can use either a relative path in the workspace or an absolute path. If an absolute path is provided, it will be preserved as is.",
				},
				old_string: {
					type: "string",
					description:
						"The exact literal text to replace (must match the file contents exactly, including all whitespace and indentation). For single replacements (default), include at least 3 lines of context BEFORE and AFTER the target text. Use empty string to create a new file.",
				},
				new_string: {
					type: "string",
					description:
						"The exact literal text to replace old_string with. When creating a new file (old_string is empty), this becomes the file content.",
				},
				expected_replacements: {
					type: "number",
					description:
						"Number of replacements expected. Defaults to 1 if not specified. Use when you want to replace multiple occurrences of the same text.",
					minimum: 1,
				},
			},
			required: ["file_path", "old_string", "new_string"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool

export { edit_file }
