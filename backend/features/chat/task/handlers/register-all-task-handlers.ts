import type { IntentBus } from "@features/intents/bus"
import { registerOnTaskCreated } from "./task-lifecycle/on-task-created"
import { registerOnTaskCancelled } from "./task-lifecycle/on-task-cancelled"
import { registerOnToolExecutionRequired } from "./on-tool-execution-required"
import { registerOnScriptFinished } from "./on-script-finished"
import { registerOnTaskNewRequested } from "./on-new-requested"
import { registerOnTaskCancelRequested } from "./task-lifecycle/on-cancel-requested"
import { registerOnTaskCompletionRequested } from "./task-lifecycle/on-task-completion-requested"
import { registerOnTaskClearRequested } from "./task-lifecycle/on-clear-requested"
import { registerOnTaskSyncEnabledSet } from "./on-sync-enabled-set"
import { registerOnTaskCondenseContextRequested } from "./request/on-condense-context-requested"
import { registerOnTaskWebviewLaunched } from "./on-webview-launched"
import { registerOnTopicCommandsRequested } from "./request/on-commands-requested"
import { registerOnTopicTodolistUpdate } from "./on-todolist-update"
import { registerOnTaskResumeRequested } from "./task-lifecycle/on-resume-requested"
import { registerOnTextareaEnhanceRequested } from "./textarea/on-textarea-enhance-requested"
import { registerOnTextareaFilesSearchRequested } from "./textarea/on-textarea-files-search-requested"
import { registerOnTextareaImagesDragged } from "./textarea/on-textarea-images-dragged"
import { registerOnTextareaImagesSelectRequested } from "./textarea/on-textarea-images-select-requested"
import { registerOnGoalAdd } from "./goal/on-goal-add"
import { registerOnGoalRemove } from "./goal/on-goal-remove"
import { registerOnGoalUpdate } from "./goal/on-goal-update"
import { registerOnGoalReorder } from "./goal/on-goal-reorder"

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
	registerOnGoalAdd(bus)
	registerOnGoalRemove(bus)
	registerOnGoalUpdate(bus)
	registerOnGoalReorder(bus)
}
