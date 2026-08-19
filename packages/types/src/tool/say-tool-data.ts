export interface SayToolData {
	tool:
		| "editedExistingFile"
		| "appliedDiff"
		| "newFileCreated"
		| "codebaseSearch"
		| "readFile"
		| "readCommandOutput"
		| "listFilesTopLevel"
		| "listFilesRecursive"
		| "searchFiles"
		| "switchMode"
		| "newTask"
		| "finishTask"
		| "generateImage"
		| "imageGenerated"
		| "runSlashCommand"
		| "updateTodoList"
		| "skill"
	path?: string
	// For readCommandOutput
	readStart?: number
	readEnd?: number
	totalBytes?: number
	searchPattern?: string
	matchCount?: number
	diff?: string
	content?: string
	// Original file content before first edit (for merged diff display in FileChangesPanel)
	originalContent?: string
	// Unified diff statistics computed by the extension
	diffStats?: { added: number; removed: number }
	regex?: string
	filePattern?: string
	mode?: string
	reason?: string
	isOutsideWorkspace?: boolean
	isProtected?: boolean
	additionalFileCount?: number // Number of additional files in the same read_file request
	lineNumber?: number
	startLine?: number // Starting line for read_file operations (for navigation on click)
	query?: string
	batchFiles?: Array<{
		path: string
		lineSnippet: string
		isOutsideWorkspace?: boolean
		key: string
		content?: string
	}>
	batchDiffs?: Array<{
		path: string
		changeCount: number
		key: string
		content: string
		// Per-file unified diff statistics computed by the extension
		diffStats?: { added: number; removed: number }
		diffs?: Array<{
			content: string
			startLine?: number
		}>
	}>
	batchDirs?: Array<{
		path: string
		recursive: boolean
		isOutsideWorkspace?: boolean
		key: string
	}>
	question?: string
	imageData?: string // Base64 encoded image data for generated images
	// Properties for runSlashCommand tool
	command?: string
	args?: string
	source?: string
	description?: string
	// Properties for skill tool
	skill?: string
}
