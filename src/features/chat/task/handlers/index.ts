import type { IntentBus } from "../../../intents/bus"
import { registerOnTaskCreated } from "./on-task-created"
import { registerOnTaskCancelled } from "./on-task-cancelled"
import { registerOnToolExecutionRequired } from "./on-tool-execution-required"
import { registerOnScriptFinished } from "./on-script-finished"
import { registerOnTaskNewRequested } from "./on-new-requested"
import { registerOnTaskCancelRequested } from "./on-cancel-requested"
import { registerOnTaskCompletionRequested } from "./on-task-completion-requested"
import { registerOnTaskClearRequested } from "./on-clear-requested"
import { registerOnTaskSyncEnabledSet } from "./on-sync-enabled-set"
import { registerOnTaskCondenseContextRequested } from "./on-condense-context-requested"
import { registerOnTaskWebviewLaunched } from "./on-webview-launched"
import { registerOnTopicCommandsRequested } from "./on-commands-requested"
import { registerOnTopicTodolistUpdate } from "./on-todolist-update"
import { registerOnTaskResumeRequested } from "./on-resume-requested"
import { registerOnTextareaEnhanceRequested } from "./on-textarea-enhance-requested"
import { registerOnTextareaFilesSearchRequested } from "./on-textarea-files-search-requested"
import { registerOnTextareaImagesDragged } from "./on-textarea-images-dragged"
import { registerOnTextareaImagesSelectRequested } from "./on-textarea-images-select-requested"

/**
 * Register all task-related intent handlers on the bus.
 */
export function registerAllTaskHandlers(bus: IntentBus): void {
	registerOnTaskCreated(bus)
	registerOnTaskCancelled(bus)
	registerOnToolExecutionRequired(bus)
	registerOnScriptFinished(bus)
	registerOnTaskNewRequested(bus)
	registerOnTaskCancelRequested(bus)
	registerOnTaskCompletionRequested(bus)
	registerOnTaskClearRequested(bus)
	registerOnTaskSyncEnabledSet(bus)
	registerOnTaskCondenseContextRequested(bus)
	registerOnTaskWebviewLaunched(bus)
	registerOnTopicCommandsRequested(bus)
	registerOnTopicTodolistUpdate(bus)
	registerOnTaskResumeRequested(bus)
	registerOnTextareaEnhanceRequested(bus)
	registerOnTextareaFilesSearchRequested(bus)
	registerOnTextareaImagesDragged(bus)
	registerOnTextareaImagesSelectRequested(bus)
}
