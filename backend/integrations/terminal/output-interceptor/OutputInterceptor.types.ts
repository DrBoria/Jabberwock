import { TerminalOutputPreviewSize } from "@jabberwock/types"

export interface OutputInterceptorOptions {
	/** Unique identifier for this command execution (typically a timestamp) */
	executionId: string
	/** ID of the task that initiated this command */
	taskId: string
	/** The command string being executed */
	command: string
	/** Directory path where command output artifacts will be stored */
	storageDir: string
	/** Size category for the preview buffer (small/medium/large) */
	previewSize: TerminalOutputPreviewSize
}
